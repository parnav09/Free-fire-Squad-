#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROLE_MIGRATION="$ROOT/supabase/migrations/20261119200000_evolution_phase_two_6_role_snapshot.sql"

# Run the exact verified parent chain and its disposable fixture first.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-two-5-db.sh"

# The Phase 2.4 fixture is deliberately minimal. Add the existing app role field
# and explicit role labels before importing the team's current role taxonomy.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS assigned_role text;

UPDATE public.team_members
SET assigned_role = 'Primary Rusher'
WHERE team_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND user_id = '10000000-0000-0000-0000-000000000001';

UPDATE public.team_members
SET assigned_role = 'Sniper + IGL'
WHERE team_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND user_id = '40000000-0000-0000-0000-000000000004';

INSERT INTO auth.users(id)
VALUES ('50000000-0000-0000-0000-000000000005');

INSERT INTO public.team_members(
  id,team_id,user_id,membership_role,status,display_name,player_number,assigned_role
) VALUES (
  'a5000000-0000-0000-0000-000000000005',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '50000000-0000-0000-0000-000000000005',
  'player','active','Unknown Role Player',2,NULL
);
SQL

# The migration imports only explicit legacy role labels. It does not backfill
# session or match role snapshots for already-existing records.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROLE_MIGRATION"

# Add an intentionally unmapped legacy label after the taxonomy import.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO auth.users(id)
VALUES ('60000000-0000-0000-0000-000000000006');

INSERT INTO public.team_members(
  id,team_id,user_id,membership_role,status,display_name,player_number,assigned_role
) VALUES (
  'a6000000-0000-0000-0000-000000000006',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '60000000-0000-0000-0000-000000000006',
  'player','active','Unmapped Role Player',3,'Mystery Role'
);

DO $$
DECLARE v_old_session uuid; v_count integer;
BEGIN
  SELECT id INTO v_old_session FROM public.canonical_sessions
  WHERE title='Roster Snapshot Test';
  SELECT count(*) INTO v_count FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_old_session
    AND (role_assignment_status_snapshot <> 'unknown'
      OR role_definition_id_snapshot IS NOT NULL
      OR role_name_snapshot IS NOT NULL);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Point 2.6 fabricated historical session role snapshots: %',v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.canonical_session_match_roles
  WHERE canonical_session_id=v_old_session;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Point 2.6 fabricated historical match role snapshots: %',v_count;
  END IF;
END $$;

-- Create a new canonical Scrim session with four distinct role states:
-- assigned, unassigned/unknown, assigned, and explicit-but-unmapped.
INSERT INTO public.scrim_records(
  id,team_id,owner_id,scrim_date,match_count,matches
) VALUES (
  'aa100000-0000-0000-0000-000000000010',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '10000000-0000-0000-0000-000000000001',
  DATE '2026-11-21',
  3,
  '[{"placement":2,"kills":4},{"placement":1,"kills":6}]'::jsonb
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session public.canonical_sessions;
  v_sync integer;
  v_selected uuid[];
BEGIN
  v_session := public.create_canonical_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'scrim',
    'Role Snapshot Test',
    '90000000-0000-0000-8000-000000000101',
    DATE '2026-11-21',
    NULL,
    NULL
  );
  INSERT INTO public.canonical_session_sources(
    team_id,canonical_session_id,source_system,scrim_record_id,created_by
  ) VALUES (
    v_session.team_id,v_session.id,'scrim',
    'aa100000-0000-0000-0000-000000000010',auth.uid()
  );
  v_sync := public.sync_canonical_session_matches(v_session.id);
  IF v_sync <> 2 THEN
    RAISE EXCEPTION 'Expected two role-test canonical matches, got %',v_sync;
  END IF;

  PERFORM public.configure_canonical_session_roster_policy(
    v_session.team_id,'scrim',2::smallint,4::smallint,false
  );
  PERFORM public.transition_canonical_session(
    v_session.id,0,'scheduled','Schedule role snapshot test',
    '90000000-0000-0000-8000-000000000102',NULL
  );

  v_selected := ARRAY[
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'a5000000-0000-0000-0000-000000000005'::uuid,
    'a6000000-0000-0000-0000-000000000006'::uuid,
    'a4000000-0000-0000-0000-000000000004'::uuid
  ];
  PERFORM public.lock_canonical_session_roster(
    v_session.id,v_selected,ARRAY[]::uuid[],
    '90000000-0000-0000-8000-000000000103'
  );
END $$;
RESET ROLE;

-- Verify session-level role ID/name/version snapshots and explicit unknown states.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session uuid;
  v_primary public.canonical_team_role_definitions;
  v_primary_v2 public.canonical_team_role_definitions;
  v_secondary public.canonical_team_role_definitions;
  v_member uuid;
  v_role_count integer;
BEGIN
  SELECT id INTO v_session FROM public.canonical_sessions WHERE title='Role Snapshot Test';

  SELECT * INTO v_primary FROM public.canonical_team_role_definitions
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND role_key='primary rusher' AND is_current;
  IF v_primary.id IS NULL OR v_primary.definition_version <> 1
    OR v_primary.role_name <> 'Primary Rusher'
  THEN RAISE EXCEPTION 'Legacy Primary Rusher taxonomy import failed'; END IF;

  SELECT count(*) INTO v_role_count FROM public.canonical_team_role_definitions
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_role_count <> 2 THEN
    RAISE EXCEPTION 'Expected only the two explicit legacy gameplay roles, got %',v_role_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_session_roster_members
    WHERE canonical_session_id=v_session
      AND player_user_id='10000000-0000-0000-0000-000000000001'
      AND role_assignment_status_snapshot='assigned'
      AND role_definition_id_snapshot=v_primary.id
      AND role_key_snapshot='primary rusher'
      AND role_name_snapshot='Primary Rusher'
      AND role_definition_version_snapshot=1
  ) THEN RAISE EXCEPTION 'Primary Rusher session role snapshot missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_session_roster_members
    WHERE canonical_session_id=v_session
      AND player_user_id='40000000-0000-0000-0000-000000000004'
      AND role_assignment_status_snapshot='assigned'
      AND role_key_snapshot='sniper + igl'
      AND role_name_snapshot='Sniper + IGL'
      AND role_definition_version_snapshot=1
  ) THEN RAISE EXCEPTION 'Sniper + IGL session role snapshot missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_session_roster_members
    WHERE canonical_session_id=v_session
      AND player_user_id='50000000-0000-0000-0000-000000000005'
      AND role_assignment_status_snapshot='unknown'
      AND role_definition_id_snapshot IS NULL
      AND role_name_snapshot IS NULL
  ) THEN RAISE EXCEPTION 'Unassigned role was not preserved as explicitly unknown'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_session_roster_members
    WHERE canonical_session_id=v_session
      AND player_user_id='60000000-0000-0000-0000-000000000006'
      AND role_assignment_status_snapshot='unmapped'
      AND role_definition_id_snapshot IS NULL
      AND role_name_snapshot='Mystery Role'
  ) THEN RAISE EXCEPTION 'Unmapped legacy role label was guessed or lost'; END IF;

  -- A role definition revision creates v2. The already-locked session keeps v1.
  v_primary_v2 := public.save_canonical_team_role_definition(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'primary rusher','Primary Rusher','Updated definition after session lock',
    true,'Clarify role definition without rewriting locked sessions',
    '90000000-0000-0000-8000-000000000104'
  );
  IF v_primary_v2.definition_version <> 2 OR NOT v_primary_v2.is_current THEN
    RAISE EXCEPTION 'Role definition version 2 was not created'; END IF;
  IF (SELECT role_definition_version_snapshot FROM public.canonical_session_roster_members
      WHERE canonical_session_id=v_session
        AND player_user_id='10000000-0000-0000-0000-000000000001') <> 1
  THEN RAISE EXCEPTION 'Role definition edit rewrote an existing session snapshot'; END IF;

  -- A second team role is created through the audited, idempotent taxonomy RPC.
  v_secondary := public.save_canonical_team_role_definition(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'secondary-rusher','Secondary Rusher','Follow-up entry and trade support',
    true,'Add a team-defined role for match-specific role changes',
    '90000000-0000-0000-8000-000000000105'
  );
  IF v_secondary.definition_version <> 1 THEN
    RAISE EXCEPTION 'New team role did not start at version 1'; END IF;

  -- Exact retry returns the same version and does not create a third version.
  v_primary_v2 := public.save_canonical_team_role_definition(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'primary rusher','Primary Rusher','Updated definition after session lock',
    true,'Clarify role definition without rewriting locked sessions',
    '90000000-0000-0000-8000-000000000104'
  );
  IF v_primary_v2.id IS DISTINCT FROM (
    SELECT id FROM public.canonical_team_role_definitions
    WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      AND role_key='primary rusher' AND definition_version=2
  ) THEN RAISE EXCEPTION 'Role definition idempotent retry returned a different version'; END IF;

  BEGIN
    PERFORM public.save_canonical_team_role_definition(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'primary rusher','Changed Payload','Conflicting payload',
      true,'Conflicting replay','90000000-0000-0000-8000-000000000104'
    );
    RAISE EXCEPTION 'Role definition idempotency key accepted a changed payload';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
END $$;
RESET ROLE;

-- Match-specific role snapshots are copied from the session roster at the first
-- verified participation record. A player may take another role in another match.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session uuid;
  v_match_one uuid;
  v_match_two uuid;
  v_owner_roster uuid;
  v_third_roster uuid;
  v_unknown_roster uuid;
  v_unmapped_roster uuid;
  v_secondary_id uuid;
  v_started_at timestamptz;
  v_effective_at timestamptz;
  v_role_event public.canonical_session_match_role_events;
  v_count integer;
BEGIN
  SELECT id INTO v_session FROM public.canonical_sessions WHERE title='Role Snapshot Test';
  PERFORM public.transition_canonical_session(
    v_session,1,'in_progress','Begin match role snapshot test',
    '90000000-0000-0000-8000-000000000106',NULL
  );
  SELECT id INTO v_match_one FROM public.canonical_session_matches
  WHERE canonical_session_id=v_session ORDER BY match_sequence LIMIT 1;
  SELECT id INTO v_match_two FROM public.canonical_session_matches
  WHERE canonical_session_id=v_session ORDER BY match_sequence DESC LIMIT 1;

  SELECT id INTO v_owner_roster FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session AND player_user_id='10000000-0000-0000-0000-000000000001';
  SELECT id INTO v_unknown_roster FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session AND player_user_id='50000000-0000-0000-0000-000000000005';
  SELECT id INTO v_unmapped_roster FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session AND player_user_id='60000000-0000-0000-0000-000000000006';
  SELECT id INTO v_third_roster FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session AND player_user_id='40000000-0000-0000-0000-000000000004';

  PERFORM public.record_canonical_match_participation(
    v_match_one,v_owner_roster,'participated','Owner played match one',
    '90000000-0000-0000-8000-000000000107'
  );
  PERFORM public.record_canonical_match_participation(
    v_match_one,v_unknown_roster,'participated','Unassigned player played match one',
    '90000000-0000-0000-8000-000000000108'
  );
  PERFORM public.record_canonical_match_participation(
    v_match_one,v_unmapped_roster,'participated','Unmapped-role player played match one',
    '90000000-0000-0000-8000-000000000109'
  );
  PERFORM public.record_canonical_match_participation(
    v_match_one,v_third_roster,'participated','Third player played match one',
    '90000000-0000-0000-8000-000000000110'
  );
  PERFORM public.record_canonical_match_participation(
    v_match_two,v_owner_roster,'participated','Owner played match two',
    '90000000-0000-0000-8000-000000000111'
  );
  PERFORM public.record_canonical_match_participation(
    v_match_two,v_third_roster,'participated','Third player played match two',
    '90000000-0000-0000-8000-000000000112'
  );
  -- A later audited correction from absent to participated must also create
  -- the match role snapshot, using the correction event's effective timestamp.
  PERFORM public.record_canonical_match_participation(
    v_match_two,v_unknown_roster,'absent','Initial attendance entry marked absent',
    '90000000-0000-0000-8000-000000000121'
  );
  PERFORM public.correct_canonical_match_participation(
    (SELECT id FROM public.canonical_session_match_participants
      WHERE canonical_session_match_id=v_match_two
        AND player_user_id='50000000-0000-0000-0000-000000000005'),
    'participated','Attendance correction confirms actual participation',
    '90000000-0000-0000-8000-000000000122'
  );

  SELECT min(changed_at) INTO v_started_at FROM public.canonical_session_lifecycle_events
  WHERE canonical_session_id=v_session AND new_status='in_progress';
  SELECT id INTO v_secondary_id FROM public.canonical_team_role_definitions
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND role_key='secondary-rusher' AND is_current AND is_active;

  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_session_match_roles
    WHERE canonical_session_match_id=v_match_one
      AND player_user_id='10000000-0000-0000-0000-000000000001'
      AND role_name_snapshot='Primary Rusher'
      AND role_definition_version_snapshot=1
      AND assignment_source='session_snapshot'
  ) THEN RAISE EXCEPTION 'Match one did not snapshot the original session role version'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_session_match_roles
    WHERE canonical_session_match_id=v_match_one
      AND player_user_id='50000000-0000-0000-0000-000000000005'
      AND role_assignment_status='unknown'
  ) THEN RAISE EXCEPTION 'Unknown role was not propagated to the match snapshot'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_session_match_roles
    WHERE canonical_session_match_id=v_match_one
      AND player_user_id='60000000-0000-0000-0000-000000000006'
      AND role_assignment_status='unmapped'
      AND role_name_snapshot='Mystery Role'
  ) THEN RAISE EXCEPTION 'Unmapped role was not propagated to the match snapshot'; END IF;

  -- Effective context before the session start must be rejected.
  BEGIN
    PERFORM public.set_canonical_session_match_role(
      v_match_one,v_owner_roster,v_secondary_id,v_started_at - interval '1 second',
      'Round 1','Invalid pre-session role change',
      '90000000-0000-0000-8000-000000000113'
    );
    RAISE EXCEPTION 'Role change before session start was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  v_effective_at := clock_timestamp();
  v_role_event := public.set_canonical_session_match_role(
    v_match_one,v_owner_roster,v_secondary_id,v_effective_at,
    'Round 2','Owner moved from entry to secondary trade role for match one',
    '90000000-0000-0000-8000-000000000114'
  );
  IF v_role_event.event_kind <> 'change'
    OR v_role_event.previous_role_name <> 'Primary Rusher'
    OR v_role_event.new_role_name <> 'Secondary Rusher'
    OR v_role_event.effective_round_label <> 'Round 2'
    OR v_role_event.effective_at <> v_effective_at
  THEN RAISE EXCEPTION 'Role change audit did not preserve prior/new role and effective context'; END IF;

  -- Exact retry is idempotent; a changed payload with the same key is rejected.
  PERFORM public.set_canonical_session_match_role(
    v_match_one,v_owner_roster,v_secondary_id,v_effective_at,
    'Round 2','Owner moved from entry to secondary trade role for match one',
    '90000000-0000-0000-8000-000000000114'
  );
  BEGIN
    PERFORM public.set_canonical_session_match_role(
      v_match_one,v_owner_roster,NULL,v_effective_at,
      'Round 2','Conflicting role replay',
      '90000000-0000-0000-8000-000000000114'
    );
    RAISE EXCEPTION 'Role change idempotency key accepted a changed payload';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_session_match_roles
    WHERE canonical_session_match_id=v_match_one
      AND player_user_id='10000000-0000-0000-0000-000000000001'
      AND role_definition_id=v_secondary_id
      AND role_name_snapshot='Secondary Rusher'
      AND assignment_source='manual'
  ) THEN RAISE EXCEPTION 'Match one role change was not applied'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_session_match_roles
    WHERE canonical_session_match_id=v_match_two
      AND player_user_id='10000000-0000-0000-0000-000000000001'
      AND role_name_snapshot='Primary Rusher'
      AND role_definition_version_snapshot=1
      AND assignment_source='session_snapshot'
  ) THEN RAISE EXCEPTION 'Changing match one rewrote the player role in match two'; END IF;

  SELECT count(*) INTO v_count FROM public.canonical_session_match_role_events
  WHERE canonical_session_match_id=v_match_one;
  IF v_count <> 5 THEN RAISE EXCEPTION 'Expected 4 initial match role snapshots + 1 change, got %',v_count; END IF;
  SELECT count(*) INTO v_count FROM public.canonical_session_match_role_events
  WHERE canonical_session_match_id=v_match_two;
  IF v_count <> 3 THEN RAISE EXCEPTION 'Expected two initial + one corrected match two role snapshots, got %',v_count; END IF;
END $$;
RESET ROLE;

-- A normal Player can read role snapshots but cannot alter roles or read staff audit.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000005',false);
DO $$
DECLARE v_session uuid; v_match uuid; v_count integer; v_owner_roster uuid; v_secondary uuid;
BEGIN
  SELECT id INTO v_session FROM public.canonical_sessions WHERE title='Role Snapshot Test';
  SELECT id INTO v_match FROM public.canonical_session_matches
  WHERE canonical_session_id=v_session ORDER BY match_sequence LIMIT 1;
  SELECT count(*) INTO v_count FROM public.canonical_session_match_roles
  WHERE canonical_session_id=v_session;
  IF v_count <> 7 THEN RAISE EXCEPTION 'Player cannot read the team match role snapshots'; END IF;
  SELECT id INTO v_owner_roster FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session AND player_user_id='10000000-0000-0000-0000-000000000001';
  SELECT id INTO v_secondary FROM public.canonical_team_role_definitions
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND role_key='secondary-rusher' AND is_current AND is_active;
  BEGIN
    PERFORM public.set_canonical_session_match_role(
      v_match,v_owner_roster,v_secondary,clock_timestamp(),
      'Round 3','Player must not change teammate role',
      '90000000-0000-0000-8000-000000000115'
    );
    RAISE EXCEPTION 'Player role unexpectedly changed a teammate match role';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  SELECT count(*) INTO v_count FROM public.canonical_session_match_role_events
  WHERE canonical_session_id=v_session;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Player can read staff-only role change audit'; END IF;
END $$;
RESET ROLE;

-- Another team cannot read this team's role taxonomy or match role snapshots.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.canonical_team_role_definitions
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Cross-team role taxonomy visibility leaked'; END IF;
  SELECT count(*) INTO v_count FROM public.canonical_session_match_roles
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Cross-team match role visibility leaked'; END IF;
END $$;
RESET ROLE;

-- Direct client writes, deletes and private trigger execution are denied.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE v_assignment uuid; v_count integer; v_before integer;
BEGIN
  SELECT id INTO v_assignment FROM public.canonical_session_match_roles
  WHERE player_user_id='10000000-0000-0000-0000-000000000001'
  LIMIT 1;
  SELECT count(*) INTO v_before FROM public.canonical_session_match_role_events;
  BEGIN
    UPDATE public.canonical_session_match_roles
    SET role_name_snapshot='Forged Role' WHERE id=v_assignment;
    RAISE EXCEPTION 'Direct match role update bypassed the role RPC';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    DELETE FROM public.canonical_session_match_role_events;
    RAISE EXCEPTION 'Direct role audit deletion was accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  SELECT count(*) INTO v_count FROM public.canonical_session_match_role_events;
  IF v_count <> v_before THEN RAISE EXCEPTION 'Direct role writes changed append-only audit'; END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.canonical_team_role_definitions','INSERT')
    OR has_table_privilege('authenticated','public.canonical_team_role_definitions','UPDATE')
    OR has_table_privilege('authenticated','public.canonical_team_role_definitions','DELETE')
  THEN RAISE EXCEPTION 'Authenticated role can directly mutate team role definitions'; END IF;
  IF has_table_privilege('authenticated','public.canonical_session_match_roles','INSERT')
    OR has_table_privilege('authenticated','public.canonical_session_match_roles','UPDATE')
    OR has_table_privilege('authenticated','public.canonical_session_match_roles','DELETE')
  THEN RAISE EXCEPTION 'Authenticated role can directly mutate match role snapshots'; END IF;
  IF has_table_privilege('authenticated','public.canonical_session_match_role_events','INSERT')
    OR has_table_privilege('authenticated','public.canonical_session_match_role_events','UPDATE')
    OR has_table_privilege('authenticated','public.canonical_session_match_role_events','DELETE')
  THEN RAISE EXCEPTION 'Authenticated role can mutate match role audit events'; END IF;
  IF has_function_privilege('authenticated','evolution_private.guard_canonical_team_role_definition()','EXECUTE')
    OR has_function_privilege('authenticated','evolution_private.snapshot_canonical_session_roster_member_role()','EXECUTE')
    OR has_function_privilege('authenticated','evolution_private.guard_canonical_session_match_role()','EXECUTE')
    OR has_function_privilege('authenticated','evolution_private.audit_canonical_session_match_role()','EXECUTE')
    OR has_function_privilege('authenticated','evolution_private.snapshot_canonical_session_match_role()','EXECUTE')
  THEN RAISE EXCEPTION 'API role can directly execute a private role trigger function'; END IF;
END $$;

-- Close the session and prove that the historical role timeline is read-only.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session uuid;
  v_match uuid;
  v_roster uuid;
  v_secondary uuid;
BEGIN
  SELECT id INTO v_session FROM public.canonical_sessions WHERE title='Role Snapshot Test';
  SELECT id INTO v_match FROM public.canonical_session_matches
  WHERE canonical_session_id=v_session ORDER BY match_sequence LIMIT 1;
  SELECT id INTO v_roster FROM public.canonical_session_roster_members
  WHERE canonical_session_id=v_session AND player_user_id='10000000-0000-0000-0000-000000000001';
  SELECT id INTO v_secondary FROM public.canonical_team_role_definitions
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND role_key='secondary-rusher' AND is_current AND is_active;

  PERFORM public.transition_canonical_session(
    v_session,2,'awaiting_results','Finish role snapshot test matches',
    '90000000-0000-0000-8000-000000000116',NULL
  );
  PERFORM public.submit_canonical_session_results(
    v_session,'90000000-0000-0000-8000-000000000117'
  );
  PERFORM public.transition_canonical_session(
    v_session,3,'verified','Verify role snapshot test session',
    '90000000-0000-0000-8000-000000000118',NULL
  );
  PERFORM public.transition_canonical_session(
    v_session,4,'closed','Close role snapshot test session',
    '90000000-0000-0000-8000-000000000119',NULL
  );

  BEGIN
    PERFORM public.set_canonical_session_match_role(
      v_match,v_roster,v_secondary,clock_timestamp(),
      'Round 4','Late role edit must be rejected after closure',
      '90000000-0000-0000-8000-000000000120'
    );
    RAISE EXCEPTION 'Closed-session role change was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
END $$;
RESET ROLE;

SELECT 'Evolution Phase Two.6 PostgreSQL integration PASS' AS result;
SQL
