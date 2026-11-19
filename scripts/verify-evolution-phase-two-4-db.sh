#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_MIGRATION="$ROOT/supabase/migrations/20261119120000_evolution_phase_two_2_canonical_session_identity.sql"
MATCH_MIGRATION="$ROOT/supabase/migrations/20261119140000_evolution_phase_two_3_canonical_match_identity.sql"
LIFECYCLE_MIGRATION="$ROOT/supabase/migrations/20261119160000_evolution_phase_two_4_session_lifecycle.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.teams (id uuid PRIMARY KEY, team_name text NOT NULL);
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  membership_role text NOT NULL CHECK (membership_role IN ('owner','coach','player')),
  status text NOT NULL CHECK (status IN ('active','pending'))
);
GRANT SELECT ON public.team_members TO authenticated;

CREATE TABLE public.scrim_records (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  scrim_date date NOT NULL,
  match_count smallint NOT NULL CHECK (match_count IN (3,4,6)),
  matches jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(matches)='array'),
  overall_rank integer,
  total_teams integer,
  personal_review jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id,owner_id,scrim_date)
);
GRANT SELECT ON public.scrim_records TO authenticated;

CREATE TABLE public.tournament_cycles (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  roster_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id,cycle_start)
);
GRANT SELECT ON public.tournament_cycles TO authenticated;

CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY,
  cycle_id uuid NOT NULL REFERENCES public.tournament_cycles(id),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  match_day smallint NOT NULL CHECK (match_day BETWEEN 1 AND 7),
  match_number smallint NOT NULL CHECK (match_number BETWEEN 1 AND 6),
  map_name text,
  drop_location text,
  placement smallint,
  kills smallint NOT NULL DEFAULT 0,
  points smallint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','draft','submitted','verified','disputed')),
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cycle_id,match_day,match_number)
);
GRANT SELECT ON public.tournament_matches TO authenticated;

CREATE TABLE public.training_sessions (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  title text NOT NULL,
  session_type text NOT NULL DEFAULT 'individual',
  scheduled_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 15,
  status text NOT NULL DEFAULT 'scheduled',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.training_sessions TO authenticated;
SQL

# Source rows exist before the canonical-session and match backfill runs.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO auth.users(id) VALUES
 ('10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003');
INSERT INTO public.teams(id,team_name) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Alpha'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Bravo');
INSERT INTO public.team_members(id,team_id,user_id,membership_role,status) VALUES
 ('a1000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','10000000-0000-0000-0000-000000000001','owner','active'),
 ('a2000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','20000000-0000-0000-0000-000000000002','player','active'),
 ('b3000000-0000-0000-0000-000000000003','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','30000000-0000-0000-0000-000000000003','owner','active');

INSERT INTO public.scrim_records(
  id,team_id,owner_id,scrim_date,match_count,matches
) VALUES (
  'aa100000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '10000000-0000-0000-0000-000000000001',
  DATE '2026-11-18',3,
  '[{"placement":2,"kills":4},{"placement":1,"kills":6}]'::jsonb
);

INSERT INTO public.tournament_cycles(
  id,team_id,cycle_start,cycle_end,title,created_by
) VALUES
 ('aa200000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',DATE '2026-11-16',DATE '2026-11-22','Alpha Week','10000000-0000-0000-0000-000000000001'),
 ('bb200000-0000-0000-0000-000000000003','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',DATE '2026-11-16',DATE '2026-11-22','Bravo Week','30000000-0000-0000-0000-000000000003');

INSERT INTO public.tournament_matches(
  id,cycle_id,team_id,match_day,match_number,map_name,placement,kills,points,status,recorded_by
) VALUES
 ('aa300000-0000-0000-0000-000000000001','aa200000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,1,NULL,NULL,0,0,'scheduled',NULL),
 ('aa300000-0000-0000-0000-000000000002','aa200000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,2,'Bermuda',1,5,17,'draft','10000000-0000-0000-0000-000000000001'),
 ('aa300000-0000-0000-0000-000000000003','aa200000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2,1,NULL,2,3,12,'disputed','10000000-0000-0000-0000-000000000001'),
 ('bb300000-0000-0000-0000-000000000004','bb200000-0000-0000-0000-000000000003','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',1,1,NULL,NULL,0,0,'scheduled',NULL);
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SESSION_MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MATCH_MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$LIFECYCLE_MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  scrim_session uuid;
  tournament_session uuid;
  bravo_session uuid;
  expected_count integer;
  record_count integer;
  played_count integer;
  map_value text;
BEGIN
  IF (SELECT count(*) FROM public.canonical_sessions) <> 3 THEN
    RAISE EXCEPTION 'canonical parent session backfill count mismatch';
  END IF;
  IF (SELECT count(*) FROM public.canonical_session_sources) <> 3 THEN
    RAISE EXCEPTION 'canonical source mapping count mismatch';
  END IF;
  IF (SELECT count(*) FROM public.canonical_session_matches) <> 6 THEN
    RAISE EXCEPTION 'canonical child match backfill count mismatch';
  END IF;
  IF (SELECT jsonb_array_length(matches) FROM public.scrim_records
      WHERE id='aa100000-0000-0000-0000-000000000001') <> 2 THEN
    RAISE EXCEPTION 'Legacy Scrim JSONB source was rewritten';
  END IF;

  SELECT canonical_session_id INTO scrim_session
  FROM public.canonical_session_sources
  WHERE source_system='scrim';
  SELECT canonical_session_id INTO tournament_session
  FROM public.canonical_session_sources
  WHERE source_system='tournament' AND team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  SELECT canonical_session_id INTO bravo_session
  FROM public.canonical_session_sources
  WHERE source_system='tournament' AND team_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  SELECT expected_match_count INTO expected_count
  FROM public.canonical_session_match_sets WHERE canonical_session_id=scrim_session;
  SELECT count(*) INTO record_count FROM public.canonical_session_matches WHERE canonical_session_id=scrim_session;
  IF expected_count <> 3 OR record_count <> 2 THEN
    RAISE EXCEPTION 'Scrim expected/actual mismatch: expected %, rows %',expected_count,record_count;
  END IF;

  SELECT actual_played_match_count INTO played_count
  FROM public.canonical_session_match_counts WHERE canonical_session_id=scrim_session;
  IF played_count <> 2 THEN
    RAISE EXCEPTION 'Source-consistent Scrim entries should count as played, got %',played_count;
  END IF;

  SELECT expected_match_count INTO expected_count
  FROM public.canonical_session_match_sets WHERE canonical_session_id=tournament_session;
  SELECT count(*) INTO record_count FROM public.canonical_session_matches WHERE canonical_session_id=tournament_session;
  IF expected_count <> 3 OR record_count <> 3 THEN
    RAISE EXCEPTION 'Tournament schedule count mismatch: expected %, rows %',expected_count,record_count;
  END IF;

  SELECT actual_played_match_count INTO played_count
  FROM public.canonical_session_match_counts WHERE canonical_session_id=tournament_session;
  IF played_count <> 2 THEN
    RAISE EXCEPTION 'Tournament played count should count recorded draft/disputed results, got %',played_count;
  END IF;

  SELECT actual_played_match_count INTO played_count
  FROM public.canonical_session_match_counts WHERE canonical_session_id=bravo_session;
  IF played_count <> 0 THEN
    RAISE EXCEPTION 'Scheduled-only Tournament cycle must have zero played matches';
  END IF;

  SELECT map_name INTO map_value
  FROM public.canonical_session_matches
  WHERE tournament_match_id='aa300000-0000-0000-0000-000000000002';
  IF map_value <> 'Bermuda' THEN
    RAISE EXCEPTION 'Tournament map metadata was not preserved';
  END IF;
  IF (SELECT map_name FROM public.canonical_session_matches
      WHERE tournament_match_id='aa300000-0000-0000-0000-000000000001') IS NOT NULL THEN
    RAISE EXCEPTION 'Missing map metadata was fabricated';
  END IF;
  IF (SELECT count(*) FROM public.canonical_session_matches
      WHERE scrim_record_id='aa100000-0000-0000-0000-000000000001'
        AND source_match_fingerprint IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'Scrim array source fingerprints missing';
  END IF;

  BEGIN
    INSERT INTO public.canonical_session_matches(
      team_id,canonical_session_id,match_sequence,source_system,
      scrim_record_id,scrim_source_sequence,source_match_fingerprint,created_by
    ) VALUES (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',bravo_session,99,'scrim',
      'aa100000-0000-0000-0000-000000000001',99,
      md5('{"placement":2,"kills":4}'::jsonb::text),
      '30000000-0000-0000-0000-000000000003'
    );
    RAISE EXCEPTION 'Cross-team source FK accepted a Scrim match';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.canonical_session_matches(
      team_id,canonical_session_id,match_sequence,source_system,
      scrim_record_id,scrim_source_sequence,source_match_fingerprint,created_by
    ) VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',scrim_session,99,'scrim',
      'aa100000-0000-0000-0000-000000000001',1,
      md5('{"placement":2,"kills":4}'::jsonb::text),
      '10000000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'One Scrim source item was attached to two canonical matches';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.scrim_records
    WHERE id='aa100000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Mapped Scrim source was destructively deleted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.tournament_cycles
    WHERE id='aa200000-0000-0000-0000-000000000002';
    RAISE EXCEPTION 'Mapped Tournament source was destructively deleted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;

-- Team A Owner exercises the guarded source sync and correction RPCs.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  scrim_session uuid;
  tournament_session uuid;
  match_id uuid;
  sync_count integer;
  event_count integer;
  sequences smallint[];
BEGIN
  SELECT canonical_session_id INTO scrim_session
  FROM public.canonical_session_sources WHERE source_system='scrim';
  SELECT canonical_session_id INTO tournament_session
  FROM public.canonical_session_sources
  WHERE source_system='tournament' AND team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  sync_count := public.sync_canonical_session_matches(scrim_session);
  IF sync_count <> 0 THEN
    RAISE EXCEPTION 'Idempotent Scrim sync inserted duplicate children: %',sync_count;
  END IF;

  SELECT id INTO match_id FROM public.canonical_session_matches
  WHERE canonical_session_id=scrim_session AND match_sequence=2;
  PERFORM public.correct_canonical_match_sequence(match_id,4::smallint,'Corrected source sequence after replay review');
  SELECT count(*) INTO event_count FROM public.canonical_session_match_sequence_events
  WHERE canonical_session_match_id=match_id AND previous_sequence=2 AND new_sequence=4
    AND reason='Corrected source sequence after replay review'
    AND changed_by=auth.uid();
  IF event_count <> 1 THEN
    RAISE EXCEPTION 'Sequence correction audit event missing';
  END IF;

  BEGIN
    PERFORM public.correct_canonical_match_sequence(match_id,1::smallint,'Duplicate sequence must fail');
    RAISE EXCEPTION 'Duplicate match sequence was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  SELECT array_agg(match_sequence ORDER BY match_sequence) INTO sequences
  FROM public.canonical_session_matches WHERE canonical_session_id=scrim_session;
  IF sequences <> ARRAY[1,4]::smallint[] THEN
    RAISE EXCEPTION 'Canonical match order is not deterministic after correction';
  END IF;

  IF (SELECT count(*) FROM public.canonical_session_matches
      WHERE canonical_session_id=tournament_session) <> 3 THEN
    RAISE EXCEPTION 'Owner lost Tournament child rows through RLS';
  END IF;
END $$;

RESET ROLE;

-- Add one new existing source row and sync it through the public, invoker RPC.
INSERT INTO public.scrim_records(
  id,team_id,owner_id,scrim_date,match_count,matches
) VALUES (
  'aa100000-0000-0000-0000-000000000005',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '10000000-0000-0000-0000-000000000001',
  DATE '2026-11-19',3,
  '[{"placement":3,"kills":2}]'::jsonb
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  session_row public.canonical_sessions;
  sync_count integer;
  source_id uuid := 'aa100000-0000-0000-0000-000000000005';
BEGIN
  session_row := public.create_canonical_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'scrim',
    'New Scrim Source',
    '44444444-4444-4444-8444-444444444444',
    DATE '2026-11-19',
    NULL,
    NULL
  );
  INSERT INTO public.canonical_session_sources(
    team_id,canonical_session_id,source_system,scrim_record_id,created_by
  ) VALUES (
    session_row.team_id,session_row.id,'scrim',source_id,auth.uid()
  );
  sync_count := public.sync_canonical_session_matches(session_row.id);
  IF sync_count <> 1 THEN
    RAISE EXCEPTION 'New source sync should insert exactly one child, got %',sync_count;
  END IF;
  IF (SELECT expected_match_count FROM public.canonical_session_match_sets
      WHERE canonical_session_id=session_row.id) <> 3 THEN
    RAISE EXCEPTION 'New source expected match count was not synchronized';
  END IF;
  sync_count := public.sync_canonical_session_matches(session_row.id);
  IF sync_count <> 0 THEN
    RAISE EXCEPTION 'Repeated source sync created duplicate child identities';
  END IF;
END $$;
RESET ROLE;

-- A Player can read team matches but cannot correct sequence metadata.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
DO $$
DECLARE
  match_id uuid;
  visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.canonical_session_matches
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF visible_count <> 6 THEN
    RAISE EXCEPTION 'Active Player should see six current Team A match identities, saw %',visible_count;
  END IF;
  SELECT id INTO match_id FROM public.canonical_session_matches
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' LIMIT 1;
  BEGIN
    PERFORM public.correct_canonical_match_sequence(match_id,9::smallint,'Player must not edit order');
    RAISE EXCEPTION 'Player unexpectedly corrected match sequence';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' AND SQLERRM <> 'canonical_match_not_found' THEN
      RAISE;
    END IF;
  END;
  IF (SELECT count(*) FROM public.canonical_session_match_sequence_events) <> 0 THEN
    RAISE EXCEPTION 'Player can read staff-only sequence audit';
  END IF;
END $$;
RESET ROLE;

-- Bravo cannot see Alpha's matches or sequence audit.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
DO $$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.canonical_session_matches
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Cross-team canonical match visibility leaked'; END IF;
  SELECT count(*) INTO visible_count FROM public.canonical_session_match_sequence_events;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'Cross-team sequence audit visibility leaked'; END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.canonical_session_matches','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role unexpectedly has canonical match DELETE';
  END IF;
  IF has_table_privilege('authenticated','public.canonical_session_match_sets','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role unexpectedly has match-set DELETE';
  END IF;
  IF has_table_privilege('anon','public.canonical_session_matches','SELECT') THEN
    RAISE EXCEPTION 'Anon unexpectedly has canonical match SELECT';
  END IF;
  IF has_table_privilege('authenticated','public.canonical_session_match_sequence_events','INSERT') THEN
    RAISE EXCEPTION 'Authenticated role unexpectedly has direct audit INSERT';
  END IF;
  IF has_function_privilege('authenticated','evolution_private.audit_canonical_match_sequence_change()','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role can directly execute the private trigger function';
  END IF;
END $$;

SELECT 'Evolution Phase Two.3 PostgreSQL integration PASS' AS result;
SQL


# Phase 2.4 lifecycle integration runs against the same isolated disposable DB
# after the exact 2.2 and 2.3 parent migrations. No live Supabase connection is used.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_session uuid;
  v_bravo_session uuid;
  v_row public.canonical_sessions;
  v_submission public.canonical_session_result_submissions;
  v_count integer;
  v_title text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.canonical_sessions) THEN
    RAISE EXCEPTION 'Phase 2.3 fixture did not produce canonical sessions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.canonical_sessions
    WHERE lifecycle_version <> 0
      OR (archived_at IS NULL AND lifecycle_status <> 'draft')
      OR (archived_at IS NOT NULL AND lifecycle_status <> 'archived')
  ) THEN
    RAISE EXCEPTION 'Existing canonical session lifecycle state was not conservatively initialized';
  END IF;
  SELECT canonical_session_id INTO v_session
  FROM public.canonical_session_sources WHERE source_system='scrim';
  SELECT canonical_session_id INTO v_bravo_session
  FROM public.canonical_session_sources
  WHERE source_system='tournament' AND team_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session uuid;
  v_row public.canonical_sessions;
  v_submission public.canonical_session_result_submissions;
  v_count integer;
  v_title text;
  v_title_after text;
BEGIN
  SELECT canonical_session_id INTO v_session
  FROM public.canonical_session_sources WHERE source_system='scrim';

  BEGIN
    PERFORM public.transition_canonical_session(
      v_session,0,'in_progress','Invalid shortcut','51000000-0000-0000-0000-000000000001',NULL
    );
    RAISE EXCEPTION 'Draft skipped Scheduled and entered In Progress';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  v_row := public.transition_canonical_session(
    v_session,0,'scheduled','Schedule confirmed','51000000-0000-0000-0000-000000000002',NULL
  );
  IF v_row.lifecycle_status <> 'scheduled' OR v_row.lifecycle_version <> 1
    OR v_row.lifecycle_scheduled_at IS NULL OR v_row.lifecycle_scheduled_by <> auth.uid()
  THEN RAISE EXCEPTION 'Scheduled transition timestamp/actor/version missing'; END IF;

  BEGIN
    PERFORM public.transition_canonical_session(
      v_session,0,'in_progress','Stale version must fail','51000000-0000-0000-0000-000000000099',NULL
    );
    RAISE EXCEPTION 'Stale lifecycle version was accepted';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
  END;

  -- Same key and payload is idempotent even when the caller retries the old version.
  v_row := public.transition_canonical_session(
    v_session,0,'scheduled','Schedule confirmed','51000000-0000-0000-0000-000000000002',NULL
  );
  IF v_row.lifecycle_version <> 1 THEN RAISE EXCEPTION 'Transition retry created a duplicate event'; END IF;

  BEGIN
    PERFORM public.transition_canonical_session(
      v_session,0,'scheduled','Different payload','51000000-0000-0000-0000-000000000002',NULL
    );
    RAISE EXCEPTION 'Idempotency key reuse with changed payload was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  v_row := public.transition_canonical_session(
    v_session,1,'in_progress','Session started','51000000-0000-0000-0000-000000000003',NULL
  );
  IF v_row.started_at IS NULL OR v_row.started_by <> auth.uid() THEN
    RAISE EXCEPTION 'In Progress timestamp/actor missing';
  END IF;

  v_row := public.transition_canonical_session(
    v_session,2,'awaiting_results','Session completed; results pending','51000000-0000-0000-0000-000000000004',NULL
  );
  IF v_row.awaiting_results_at IS NULL OR v_row.awaiting_results_by <> auth.uid() THEN
    RAISE EXCEPTION 'Awaiting Results timestamp/actor missing';
  END IF;

  BEGIN
    PERFORM public.transition_canonical_session(
      v_session,3,'verified','Cannot verify without submission','51000000-0000-0000-0000-000000000005',NULL
    );
    RAISE EXCEPTION 'Verification without a result submission was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  v_submission := public.submit_canonical_session_results(
    v_session,'52000000-0000-0000-0000-000000000001'
  );
  IF v_submission.submitted_by <> auth.uid() OR v_submission.submitted_at IS NULL THEN
    RAISE EXCEPTION 'Result submission receipt missing actor/timestamp';
  END IF;
  IF (public.submit_canonical_session_results(
    v_session,'52000000-0000-0000-0000-000000000001'
  )).id <> v_submission.id THEN
    RAISE EXCEPTION 'Same result submission key was not idempotent';
  END IF;
  BEGIN
    PERFORM public.submit_canonical_session_results(
      v_session,'52000000-0000-0000-0000-000000000002'
    );
    RAISE EXCEPTION 'Second result submission with different key was accepted';
  EXCEPTION WHEN SQLSTATE '23505' THEN NULL;
  END;

  v_row := public.transition_canonical_session(
    v_session,3,'verified','Submitted results checked','51000000-0000-0000-0000-000000000006',NULL
  );
  IF v_row.results_verified_at IS NULL OR v_row.results_verified_by <> auth.uid() THEN
    RAISE EXCEPTION 'Verified timestamp/actor missing';
  END IF;
  IF (public.submit_canonical_session_results(
    v_session,'52000000-0000-0000-0000-000000000001'
  )).id <> v_submission.id THEN
    RAISE EXCEPTION 'Result submission retry stopped being idempotent after verification';
  END IF;

  BEGIN
    PERFORM public.transition_canonical_session(
      v_session,4,'archived','Cannot skip Closed','51000000-0000-0000-0000-000000000007',NULL
    );
    RAISE EXCEPTION 'Verified skipped Closed and entered Archived';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  v_row := public.transition_canonical_session(
    v_session,4,'closed','Review complete','51000000-0000-0000-0000-000000000008',NULL
  );
  IF v_row.closed_at IS NULL OR v_row.closed_by <> auth.uid() THEN
    RAISE EXCEPTION 'Closed timestamp/actor missing';
  END IF;
  v_row := public.transition_canonical_session(
    v_session,5,'archived','Historical session retained','51000000-0000-0000-0000-000000000009',NULL
  );
  IF v_row.archived_at IS NULL OR v_row.archived_by <> auth.uid()
    OR v_row.archive_reason <> 'Historical session retained'
  THEN RAISE EXCEPTION 'Archive metadata missing'; END IF;

  SELECT title INTO v_title FROM public.canonical_sessions WHERE id=v_session;
  UPDATE public.canonical_sessions SET title='Must not edit archived session' WHERE id=v_session;
  SELECT title INTO v_title_after FROM public.canonical_sessions WHERE id=v_session;
  IF v_title_after IS DISTINCT FROM v_title THEN
    RAISE EXCEPTION 'Archived session remained editable through direct table update';
  END IF;

  v_row := public.reopen_canonical_session(
    v_session,6,'closed','Correction: archive applied prematurely','53000000-0000-0000-0000-000000000001'
  );
  IF v_row.lifecycle_status <> 'closed' OR v_row.archived_at IS NOT NULL
    OR v_row.lifecycle_version <> 7
  THEN RAISE EXCEPTION 'Audited archive reopening failed'; END IF;

  PERFORM pg_catalog.set_config('app.evolution_session_lifecycle_action','',true);
  PERFORM pg_catalog.set_config('app.evolution_session_lifecycle_reason','',true);
  PERFORM pg_catalog.set_config('app.evolution_session_lifecycle_idempotency_key','',true);
  BEGIN
    UPDATE public.canonical_sessions
    SET lifecycle_status='scheduled', lifecycle_version=lifecycle_version+1
    WHERE id=v_session;
    RAISE EXCEPTION 'Direct lifecycle status update bypassed the guarded RPC';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  SELECT count(*) INTO v_count FROM public.canonical_session_lifecycle_events
  WHERE canonical_session_id=v_session;
  IF v_count <> 7 THEN RAISE EXCEPTION 'Expected seven append-only lifecycle events, found %',v_count; END IF;
  IF (SELECT count(*) FROM public.canonical_session_lifecycle_events
      WHERE canonical_session_id=v_session AND event_kind='reopen'
        AND previous_status='archived' AND new_status='closed'
        AND changed_by=auth.uid()) <> 1
  THEN RAISE EXCEPTION 'Reopen correction audit event missing'; END IF;

  BEGIN
    INSERT INTO public.canonical_session_lifecycle_events(
      team_id,canonical_session_id,lifecycle_version,event_kind,
      previous_status,new_status,reason,idempotency_key,changed_by
    ) VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_session,99,'transition',
      'closed','archived','forged event','54000000-0000-0000-0000-000000000001',auth.uid()
    );
    RAISE EXCEPTION 'Authenticated role inserted a forged lifecycle audit event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Player role cannot transition or read staff-only lifecycle audit.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
DO $$
DECLARE
  v_session uuid;
  v_count integer;
BEGIN
  SELECT canonical_session_id INTO v_session
  FROM public.canonical_session_sources WHERE source_system='scrim';
  BEGIN
    PERFORM public.transition_canonical_session(
      v_session,7,'archived','Player cannot transition','55000000-0000-0000-0000-000000000001',NULL
    );
    RAISE EXCEPTION 'Player unexpectedly transitioned a canonical session';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    PERFORM public.submit_canonical_session_results(
      v_session,'52000000-0000-0000-0000-000000000003'
    );
    RAISE EXCEPTION 'Player unexpectedly submitted session results';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    PERFORM public.reopen_canonical_session(
      v_session,7,'verified','Player cannot reopen','53000000-0000-0000-0000-000000000002'
    );
    RAISE EXCEPTION 'Player unexpectedly reopened a canonical session';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  SELECT count(*) INTO v_count FROM public.canonical_session_lifecycle_events
  WHERE canonical_session_id=v_session;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Player can read staff-only lifecycle audit'; END IF;
  SELECT count(*) INTO v_count FROM public.canonical_session_result_submissions
  WHERE canonical_session_id=v_session;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Player can read staff-only result submission receipt'; END IF;
END $$;
RESET ROLE;

-- A no-show is a cancellation branch, not a fabricated/played match.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
DO $$
DECLARE
  v_session uuid;
  v_row public.canonical_sessions;
  v_count integer;
BEGIN
  SELECT canonical_session_id INTO v_session
  FROM public.canonical_session_sources
  WHERE source_system='tournament' AND team_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  v_row := public.transition_canonical_session(
    v_session,0,'scheduled','Scheduled tournament session','56000000-0000-0000-0000-000000000001',NULL
  );
  BEGIN
    PERFORM public.transition_canonical_session(
      v_session,1,'cancelled','No-show code is mandatory','56000000-0000-0000-0000-000000000099',NULL
    );
    RAISE EXCEPTION 'Cancellation without a reason code was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  v_row := public.transition_canonical_session(
    v_session,1,'cancelled','Team did not attend the scheduled session','56000000-0000-0000-0000-000000000002','no_show'
  );
  IF v_row.lifecycle_status <> 'cancelled' OR v_row.cancellation_reason_code <> 'no_show'
    OR v_row.cancelled_at IS NULL OR v_row.cancelled_by <> auth.uid()
  THEN RAISE EXCEPTION 'No-show cancellation metadata missing'; END IF;
  SELECT actual_played_match_count INTO v_count
  FROM public.canonical_session_match_counts WHERE canonical_session_id=v_session;
  IF v_count <> 0 THEN RAISE EXCEPTION 'No-show cancellation fabricated a played match'; END IF;

  v_row := public.transition_canonical_session(
    v_session,2,'archived','Retain cancelled no-show session','56000000-0000-0000-0000-000000000003',NULL
  );
  IF v_row.lifecycle_status <> 'archived' OR v_row.archived_at IS NULL
    OR v_row.cancellation_reason_code IS NOT NULL
  THEN RAISE EXCEPTION 'Cancelled session archive did not normalize lifecycle metadata'; END IF;
  IF (SELECT count(*) FROM public.canonical_session_lifecycle_events
      WHERE canonical_session_id=v_session AND cancellation_reason_code='no_show') <> 1
  THEN RAISE EXCEPTION 'No-show reason was not preserved in the append-only event'; END IF;
END $$;
RESET ROLE;

-- Cross-team access and direct mutation privileges fail closed.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.canonical_session_lifecycle_events
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Cross-team lifecycle audit visibility leaked'; END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.canonical_session_lifecycle_events','INSERT') THEN
    RAISE EXCEPTION 'Authenticated role can directly insert lifecycle audit events';
  END IF;
  IF has_table_privilege('authenticated','public.canonical_session_lifecycle_events','UPDATE') THEN
    RAISE EXCEPTION 'Authenticated role can update lifecycle audit events';
  END IF;
  IF has_table_privilege('authenticated','public.canonical_session_lifecycle_events','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role can delete lifecycle audit events';
  END IF;
  IF has_table_privilege('authenticated','public.canonical_session_result_submissions','DELETE') THEN
    RAISE EXCEPTION 'Authenticated role can delete result submission receipts';
  END IF;
  IF has_column_privilege('authenticated','public.canonical_session_result_submissions','submitted_at','INSERT') THEN
    RAISE EXCEPTION 'Authenticated role can spoof result submission timestamps';
  END IF;
  IF has_function_privilege('anon','public.transition_canonical_session(uuid,integer,text,text,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Anon can execute lifecycle transition RPC';
  END IF;
  IF has_function_privilege('authenticated','evolution_private.guard_canonical_session_lifecycle()','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role can execute private lifecycle guard trigger function';
  END IF;
  IF has_function_privilege('authenticated','evolution_private.audit_canonical_session_lifecycle()','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role can execute private lifecycle audit trigger function';
  END IF;
END $$;

SELECT 'Evolution Phase Two.4 PostgreSQL integration PASS' AS result;
SQL
