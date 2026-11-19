#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROSTER_MIGRATION="$ROOT/supabase/migrations/20261119180000_evolution_phase_two_5_session_roster_snapshot.sql"

# Reuse the exact verified parent chain and its minimal source fixtures.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-two-4-db.sh"

# The shared Phase 2.4 fixture intentionally models only the columns needed by
# Points 2.2–2.4. Add the live roster columns and team settings used by Point 2.5.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.team_members
  ADD COLUMN display_name text NOT NULL DEFAULT 'Player',
  ADD COLUMN player_number smallint;

UPDATE public.team_members
SET display_name = CASE user_id
  WHEN '10000000-0000-0000-0000-000000000001'::uuid THEN 'Owner Alpha'
  WHEN '20000000-0000-0000-0000-000000000002'::uuid THEN 'Player Two'
  WHEN '30000000-0000-0000-0000-000000000003'::uuid THEN 'Owner Bravo'
  ELSE display_name
END,
player_number = CASE user_id
  WHEN '10000000-0000-0000-0000-000000000001'::uuid THEN 1
  WHEN '20000000-0000-0000-0000-000000000002'::uuid THEN 2
  WHEN '30000000-0000-0000-0000-000000000003'::uuid THEN 1
  ELSE player_number
END;

INSERT INTO auth.users(id) VALUES ('40000000-0000-0000-0000-000000000004');
INSERT INTO public.team_members(id,team_id,user_id,membership_role,status,display_name,player_number)
VALUES (
  'a4000000-0000-0000-0000-000000000004',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '40000000-0000-0000-0000-000000000004',
  'player','active','Third Player',3
);

CREATE TABLE public.team_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id,setting_key)
);
GRANT SELECT ON public.team_settings TO authenticated;
INSERT INTO public.team_settings(team_id,setting_key,setting_value)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','roster_capacity','4'::jsonb),
       ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','roster_capacity','4'::jsonb);
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROSTER_MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_before integer;
BEGIN
  SELECT count(*) INTO v_before FROM public.canonical_session_rosters;
  IF v_before <> 0 THEN
    RAISE EXCEPTION 'Point 2.5 fabricated historical roster snapshots: %',v_before;
  END IF;
END $$;

-- A new Scrim session is created through the canonical APIs, then its source
-- matches are synchronized before roster lock.
INSERT INTO public.scrim_records(
  id,team_id,owner_id,scrim_date,match_count,matches
) VALUES (
  'aa100000-0000-0000-0000-000000000009',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '10000000-0000-0000-0000-000000000001',
  DATE '2026-11-20',
  3,
  '[{"placement":2,"kills":4},{"placement":1,"kills":6}]'::jsonb
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session public.canonical_sessions;
  v_sync integer;
BEGIN
  v_session := public.create_canonical_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'scrim',
    'Roster Snapshot Test',
    '90000000-0000-0000-8000-000000000001',
    DATE '2026-11-20',
    NULL,
    NULL
  );
  INSERT INTO public.canonical_session_sources(
    team_id,canonical_session_id,source_system,scrim_record_id,created_by
  ) VALUES (
    v_session.team_id,v_session.id,'scrim',
    'aa100000-0000-0000-0000-000000000009',auth.uid()
  );
  v_sync := public.sync_canonical_session_matches(v_session.id);
  IF v_sync <> 2 THEN
    RAISE EXCEPTION 'Expected two canonical matches for the roster fixture, got %',v_sync;
  END IF;

  PERFORM public.configure_canonical_session_roster_policy(
    v_session.team_id,'scrim',2::smallint,3::smallint,false
  );
  -- Session-type policies are configuration, not a fixed 4-player assumption.
  PERFORM public.configure_canonical_session_roster_policy(
    v_session.team_id,'training',1::smallint,1::smallint,true
  );

  BEGIN
    UPDATE public.canonical_session_roster_policies
    SET maximum_players=4
    WHERE team_id=v_session.team_id AND session_type='scrim';
    RAISE EXCEPTION 'Direct roster policy write bypassed the configuration RPC';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM public.transition_canonical_session(
    v_session.id,0,'scheduled','Schedule roster snapshot test',
    '90000000-0000-0000-8000-000000000002',NULL
  );

  PERFORM public.lock_canonical_session_roster(
    v_session.id,
    ARRAY[
      'a1000000-0000-0000-0000-000000000001'::uuid,
      'a2000000-0000-0000-0000-000000000002'::uuid
    ],
    ARRAY['a4000000-0000-0000-0000-000000000004'::uuid],
    '90000000-0000-0000-8000-000000000003'
  );
END $$;
RESET ROLE;

-- Snapshot identity, capacity, selection state and idempotent replay.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session uuid;
  v_roster public.canonical_session_rosters;
  v_member_id uuid;
  v_count integer;
  v_name text;
  v_slot smallint;
BEGIN
  SELECT id INTO v_session FROM public.canonical_sessions WHERE title='Roster Snapshot Test';
  SELECT * INTO v_roster FROM public.canonical_session_rosters
  WHERE canonical_session_id=v_session;

  IF v_roster.capacity_snapshot <> 4 OR v_roster.minimum_players_snapshot <> 2
    OR v_roster.maximum_players_snapshot <> 3 OR v_roster.selected_member_count <> 2
    OR v_roster.eligible_member_count <> 3
  THEN RAISE EXCEPTION 'Roster capacity/policy snapshot is incorrect'; END IF;

  SELECT count(*) INTO v_count FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session;
  IF v_count <> 3 THEN RAISE EXCEPTION 'Expected all three eligible members to be snapshotted, got %',v_count; END IF;

  IF (SELECT selection_status FROM public.canonical_session_roster_members
      WHERE canonical_session_id=v_session AND player_user_id='10000000-0000-0000-0000-000000000001')
      <> 'selected'
  THEN RAISE EXCEPTION 'Selected roster member state missing'; END IF;
  IF (SELECT selection_status FROM public.canonical_session_roster_members
      WHERE canonical_session_id=v_session AND player_user_id='40000000-0000-0000-0000-000000000004')
      <> 'invited'
  THEN RAISE EXCEPTION 'Invited roster member state missing'; END IF;

  -- The same idempotency key and logically identical (reordered) arrays returns
  -- the original immutable snapshot header.
  PERFORM public.lock_canonical_session_roster(
    v_session,
    ARRAY[
      'a2000000-0000-0000-0000-000000000002'::uuid,
      'a1000000-0000-0000-0000-000000000001'::uuid
    ],
    ARRAY['a4000000-0000-0000-0000-000000000004'::uuid],
    '90000000-0000-0000-8000-000000000003'
  );

  BEGIN
    PERFORM public.lock_canonical_session_roster(
      v_session,
      ARRAY['a1000000-0000-0000-0000-000000000001'::uuid],
      ARRAY['a4000000-0000-0000-0000-000000000004'::uuid],
      '90000000-0000-0000-8000-000000000003'
    );
    RAISE EXCEPTION 'Changed payload reused a roster snapshot idempotency key';
  EXCEPTION WHEN SQLSTATE '22023' OR SQLSTATE '23505' THEN NULL;
  END;

  SELECT id INTO v_member_id FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session
    AND player_user_id='40000000-0000-0000-0000-000000000004';
  PERFORM public.set_canonical_session_roster_member_status(
    v_member_id,'selected','Coach selected the invited player',
    '90000000-0000-0000-8000-000000000004'
  );
  PERFORM public.set_canonical_session_roster_member_status(
    v_member_id,'confirmed','Player confirmed availability',
    '90000000-0000-0000-8000-000000000005'
  );
  IF (SELECT selection_status FROM public.canonical_session_roster_members WHERE id=v_member_id)
      <> 'confirmed'
  THEN RAISE EXCEPTION 'Confirmed roster state was not persisted'; END IF;

  BEGIN
    PERFORM public.set_canonical_session_roster_member_status(
      v_member_id,'invited','Invalid backward transition',
      '90000000-0000-0000-8000-000000000006'
    );
    RAISE EXCEPTION 'Invalid roster status transition was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  SELECT display_name_snapshot,player_number_snapshot INTO v_name,v_slot
  FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session
    AND player_user_id='20000000-0000-0000-0000-000000000002';
  IF v_name <> 'Player Two' OR v_slot <> 2 THEN
    RAISE EXCEPTION 'Player identity/slot snapshot was not captured';
  END IF;

  SELECT count(*) INTO v_count FROM public.canonical_session_roster_member_events
  WHERE canonical_session_id=v_session;
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'Expected 3 snapshot events + 2 selection events, got %',v_count;
  END IF;
END $$;
RESET ROLE;

-- The session starts, then per-match attendance is recorded and corrected
-- through explicit RPCs. Substitution linkage itself remains Point 2.7.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session uuid;
  v_match uuid;
  v_owner_roster uuid;
  v_player_roster uuid;
  v_third_roster uuid;
  v_participant public.canonical_session_match_participants;
  v_count integer;
BEGIN
  SELECT id INTO v_session FROM public.canonical_sessions WHERE title='Roster Snapshot Test';
  PERFORM public.transition_canonical_session(
    v_session,1,'in_progress','Begin roster participation test',
    '90000000-0000-0000-8000-000000000007',NULL
  );
  SELECT id INTO v_match FROM public.canonical_session_matches
  WHERE canonical_session_id=v_session ORDER BY match_sequence LIMIT 1;
  SELECT id INTO v_owner_roster FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session AND player_user_id='10000000-0000-0000-0000-000000000001';
  SELECT id INTO v_player_roster FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session AND player_user_id='20000000-0000-0000-0000-000000000002';
  SELECT id INTO v_third_roster FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session AND player_user_id='40000000-0000-0000-0000-000000000004';

  v_participant := public.record_canonical_match_participation(
    v_match,v_owner_roster,'participated','Player participated in match 1',
    '90000000-0000-0000-8000-000000000008'
  );
  PERFORM public.record_canonical_match_participation(
    v_match,v_player_roster,'absent','Selected player was absent in match 1',
    '90000000-0000-0000-8000-000000000009'
  );
  PERFORM public.record_canonical_match_participation(
    v_match,v_third_roster,'participated','Confirmed player participated in match 1',
    '90000000-0000-0000-8000-000000000010'
  );

  -- Idempotent retry returns the existing participant and does not duplicate events.
  PERFORM public.record_canonical_match_participation(
    v_match,v_owner_roster,'participated','Player participated in match 1',
    '90000000-0000-0000-8000-000000000008'
  );
  SELECT count(*) INTO v_count FROM public.canonical_session_match_participants
  WHERE canonical_session_match_id=v_match;
  IF v_count <> 3 THEN RAISE EXCEPTION 'Duplicate participant rows were created'; END IF;

  BEGIN
    PERFORM public.record_canonical_match_participation(
      v_match,v_owner_roster,'absent','Conflicting duplicate participant',
      '90000000-0000-0000-8000-000000000011'
    );
    RAISE EXCEPTION 'Second participant state for the same player/match was accepted';
  EXCEPTION WHEN SQLSTATE '23505' THEN NULL;
  END;

  PERFORM public.correct_canonical_match_participation(
    (SELECT id FROM public.canonical_session_match_participants
      WHERE canonical_session_match_id=v_match AND player_user_id='20000000-0000-0000-0000-000000000002'),
    'substituted','Player was replaced before match start',
    '90000000-0000-0000-8000-000000000012'
  );
  IF (SELECT participation_status FROM public.canonical_session_match_participants
      WHERE canonical_session_match_id=v_match AND player_user_id='20000000-0000-0000-0000-000000000002')
      <> 'substituted'
  THEN RAISE EXCEPTION 'Substituted participation state was not persisted'; END IF;

  SELECT count(*) INTO v_count
  FROM public.canonical_session_match_participation_events e
  JOIN public.canonical_session_match_participants p ON p.id=e.participant_id
  WHERE p.canonical_session_match_id=v_match;
  IF v_count <> 4 THEN RAISE EXCEPTION 'Participation audit event count mismatch: %',v_count; END IF;
END $$;
RESET ROLE;

-- Historical identity survives mutable IGN/slot changes and physical membership
-- deletion (the existing leave_team() workflow deletes team_members rows).
UPDATE public.team_members SET display_name='Renamed Player',player_number=4
WHERE id='a4000000-0000-0000-0000-000000000004';
DELETE FROM public.team_members
WHERE id='a2000000-0000-0000-0000-000000000002';

DO $$
DECLARE v_session uuid; v_name text; v_slot smallint; v_user uuid; v_count integer;
BEGIN
  SELECT id INTO v_session FROM public.canonical_sessions WHERE title='Roster Snapshot Test';
  SELECT display_name_snapshot,player_number_snapshot,player_user_id
  INTO v_name,v_slot,v_user
  FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session
    AND player_user_id='20000000-0000-0000-0000-000000000002';
  IF v_name <> 'Player Two' OR v_slot <> 2
    OR v_user <> '20000000-0000-0000-0000-000000000002'
  THEN RAISE EXCEPTION 'Historical roster changed after member leave'; END IF;
  SELECT display_name_snapshot,player_number_snapshot INTO v_name,v_slot
  FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session
    AND player_user_id='40000000-0000-0000-0000-000000000004';
  IF v_name <> 'Third Player' OR v_slot <> 3
  THEN RAISE EXCEPTION 'Historical roster changed after IGN/slot edit'; END IF;
  SELECT count(*) INTO v_count FROM public.canonical_session_match_participants
  WHERE canonical_session_id=v_session AND player_user_id='20000000-0000-0000-0000-000000000002';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Match participation did not survive membership deletion'; END IF;
END $$;

-- A regular Player can read their team's snapshot, but cannot change statuses or
-- record participation. Cross-team users cannot see another team's snapshots.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000004',false);
DO $$
DECLARE v_session uuid; v_roster_member uuid; v_match uuid; v_count integer;
BEGIN
  SELECT id INTO v_session FROM public.canonical_sessions WHERE title='Roster Snapshot Test';
  SELECT count(*) INTO v_count FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session;
  IF v_count <> 3 THEN RAISE EXCEPTION 'Active Player cannot read their team roster snapshot'; END IF;
  SELECT id INTO v_roster_member FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session AND player_user_id=auth.uid();
  SELECT id INTO v_match FROM public.canonical_session_matches
  WHERE canonical_session_id=v_session ORDER BY match_sequence LIMIT 1;
  BEGIN
    PERFORM public.record_canonical_match_participation(
      v_match,v_roster_member,'participated','Player must not record official participation',
      '90000000-0000-0000-8000-000000000013'
    );
    RAISE EXCEPTION 'Player role unexpectedly recorded participation';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  SELECT count(*) INTO v_count FROM public.canonical_session_roster_member_events
  WHERE canonical_session_id=v_session;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Player can read staff-only roster audit'; END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.canonical_session_roster_members
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Cross-team roster snapshot visibility leaked'; END IF;
  SELECT count(*) INTO v_count FROM public.canonical_session_match_participants
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Cross-team participation visibility leaked'; END IF;
END $$;
RESET ROLE;

-- Trigger guards, immutable audit, no client DELETE, and no direct trigger calls.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE v_member uuid; v_count integer; v_before integer;
BEGIN
  SELECT count(*) INTO v_before FROM public.canonical_session_match_participation_events;
  SELECT id INTO v_member FROM public.canonical_session_roster_members
  WHERE player_user_id='10000000-0000-0000-0000-000000000001'
  LIMIT 1;
  BEGIN
    UPDATE public.canonical_session_roster_members
    SET selection_status='invited' WHERE id=v_member;
    RAISE EXCEPTION 'Direct roster status update bypassed the RPC';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    DELETE FROM public.canonical_session_match_participants
    WHERE player_user_id='10000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Direct participant deletion was accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  SELECT count(*) INTO v_count FROM public.canonical_session_match_participation_events;
  IF v_count <> v_before THEN RAISE EXCEPTION 'Direct writes unexpectedly changed participation audit'; END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.canonical_session_roster_policies','INSERT')
    OR has_table_privilege('authenticated','public.canonical_session_roster_policies','UPDATE')
  THEN RAISE EXCEPTION 'Authenticated role can bypass the roster policy configuration RPC'; END IF;
  IF has_table_privilege('authenticated','public.canonical_session_rosters','UPDATE')
    OR has_table_privilege('authenticated','public.canonical_session_rosters','DELETE')
  THEN RAISE EXCEPTION 'Authenticated role can mutate roster snapshot headers'; END IF;
  IF has_table_privilege('authenticated','public.canonical_session_roster_member_events','INSERT')
    OR has_table_privilege('authenticated','public.canonical_session_roster_member_events','UPDATE')
    OR has_table_privilege('authenticated','public.canonical_session_roster_member_events','DELETE')
  THEN RAISE EXCEPTION 'Authenticated role can mutate roster audit events'; END IF;
  IF has_table_privilege('authenticated','public.canonical_session_match_participation_events','INSERT')
    OR has_table_privilege('authenticated','public.canonical_session_match_participation_events','UPDATE')
    OR has_table_privilege('authenticated','public.canonical_session_match_participation_events','DELETE')
  THEN RAISE EXCEPTION 'Authenticated role can mutate participation audit events'; END IF;
  IF has_table_privilege('authenticated','public.canonical_session_match_participants','DELETE')
  THEN RAISE EXCEPTION 'Authenticated role can delete canonical match participants'; END IF;
  IF has_function_privilege('authenticated','evolution_private.guard_canonical_session_roster_member()','EXECUTE')
    OR has_function_privilege('authenticated','evolution_private.audit_canonical_session_roster_member()','EXECUTE')
    OR has_function_privilege('authenticated','evolution_private.guard_canonical_session_match_participant()','EXECUTE')
    OR has_function_privilege('authenticated','evolution_private.audit_canonical_session_match_participation()','EXECUTE')
  THEN RAISE EXCEPTION 'API role can directly execute a private roster trigger function'; END IF;
END $$;

SELECT 'Evolution Phase Two.5 PostgreSQL integration PASS' AS result;
SQL
