#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Replay the verified canonical Evolution schema and legacy Planning/Training/Scrim/Tournament fixtures.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-two-10-db.sh"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- The integration fixture fills legacy team tables that are not needed by Phase 2.10 itself.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS team_description text,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

UPDATE public.teams t
SET owner_id = tm.user_id
FROM public.team_members tm
WHERE tm.team_id=t.id AND tm.membership_role='owner' AND tm.status='active'
  AND t.owner_id IS NULL;

DO $fixtures$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'team_settings','team_join_requests','team_ratings','team_data_retention_settings',
    'daily_drills','daily_scores','daily_score_feedback','player_drill_assignments',
    'player_nicknames','player_character_loadouts','training_log','training_session_notes',
    'training_drills','practice_tasks','practice_task_events','training_session_participants',
    'training_results','scrim_team_reviews'
  ] LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE)',
      table_name
    );
  END LOOP;
END
$fixtures$;

-- Add representative persisted player scoring/evaluation columns to the legacy fixture tables.
ALTER TABLE public.daily_scores
  ADD COLUMN IF NOT EXISTS score_date date,
  ADD COLUMN IF NOT EXISTS player_id uuid,
  ADD COLUMN IF NOT EXISTS evaluator_id uuid,
  ADD COLUMN IF NOT EXISTS communication integer,
  ADD COLUMN IF NOT EXISTS coordination integer,
  ADD COLUMN IF NOT EXISTS decision_making integer,
  ADD COLUMN IF NOT EXISTS role_execution integer,
  ADD COLUMN IF NOT EXISTS map_awareness integer,
  ADD COLUMN IF NOT EXISTS total integer,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS improvement_target text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS review_visibility text DEFAULT 'team';
ALTER TABLE public.daily_score_feedback
  ADD COLUMN IF NOT EXISTS score_id uuid REFERENCES public.daily_scores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS player_id uuid,
  ADD COLUMN IF NOT EXISTS improvement_target text,
  ADD COLUMN IF NOT EXISTS improvement_notes text,
  ADD COLUMN IF NOT EXISTS mistake_notes text,
  ADD COLUMN IF NOT EXISTS context_notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.daily_drills
  ADD COLUMN IF NOT EXISTS drill_date date,
  ADD COLUMN IF NOT EXISTS player_id uuid,
  ADD COLUMN IF NOT EXISTS drill_name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS minutes integer,
  ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS score integer,
  ADD COLUMN IF NOT EXISTS max_score integer,
  ADD COLUMN IF NOT EXISTS evaluator uuid,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS improvement_target text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.team_ratings
  ADD COLUMN IF NOT EXISTS week_start date,
  ADD COLUMN IF NOT EXISTS evaluator_id uuid,
  ADD COLUMN IF NOT EXISTS communication_quality integer,
  ADD COLUMN IF NOT EXISTS team_coordination integer,
  ADD COLUMN IF NOT EXISTS igl_decision_making integer,
  ADD COLUMN IF NOT EXISTS rotation_management integer,
  ADD COLUMN IF NOT EXISTS role_consistency integer,
  ADD COLUMN IF NOT EXISTS map_adaptation integer,
  ADD COLUMN IF NOT EXISTS match_consistency integer,
  ADD COLUMN IF NOT EXISTS survival_decisions integer,
  ADD COLUMN IF NOT EXISTS replay_improvement integer,
  ADD COLUMN IF NOT EXISTS total integer,
  ADD COLUMN IF NOT EXISTS notes_worked text,
  ADD COLUMN IF NOT EXISTS notes_wrong text,
  ADD COLUMN IF NOT EXISTS next_focus text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

INSERT INTO public.daily_scores(
  id,team_id,score_date,player_id,evaluator_id,communication,coordination,
  decision_making,role_execution,map_awareness,total,notes,improvement_target,review_visibility
) VALUES (
  'de500000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  DATE '2026-11-20',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  8,7,9,8,7,39,'Backup score fixture','Rotation timing','team'
);
INSERT INTO public.daily_score_feedback(
  id,score_id,team_id,player_id,improvement_target,improvement_notes,mistake_notes,context_notes
) VALUES (
  'de500000-0000-0000-0000-000000000002',
  'de500000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '10000000-0000-0000-0000-000000000001',
  'Rotation timing','Earlier zone checks','Late rotate','Final circle review'
);
INSERT INTO public.daily_drills(
  id,team_id,drill_date,player_id,drill_name,category,minutes,completed,score,max_score,evaluator,notes,improvement_target
) VALUES (
  'de500000-0000-0000-0000-000000000003',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  DATE '2026-11-20',
  '10000000-0000-0000-0000-000000000001',
  'Comms review','communication',25,true,18,20,
  '10000000-0000-0000-0000-000000000001',
  'Preserved player drill result','Callout timing'
);
INSERT INTO public.team_ratings(
  id,team_id,week_start,evaluator_id,communication_quality,team_coordination,
  igl_decision_making,rotation_management,role_consistency,map_adaptation,
  match_consistency,survival_decisions,replay_improvement,total,notes_worked,notes_wrong,next_focus
) VALUES (
  'de500000-0000-0000-0000-000000000004',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  DATE '2026-11-16',
  '10000000-0000-0000-0000-000000000001',
  8,8,7,8,9,7,8,8,7,70,
  'Team communication improved','Late rotations','Zone timing'
);

-- A custom parent/child pair proves that tables without their own team_id are discovered
-- through their FK and restored only through the selected team's parent records.
CREATE TABLE public.drg_backup_fixture (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  canonical_session_id uuid NOT NULL,
  CONSTRAINT drg_backup_fixture_session_team_fk
    FOREIGN KEY (canonical_session_id,team_id)
    REFERENCES public.canonical_sessions(id,team_id) ON DELETE CASCADE
);
CREATE TABLE public.drg_backup_fixture_events (
  id uuid PRIMARY KEY,
  fixture_id uuid NOT NULL REFERENCES public.drg_backup_fixture(id) ON DELETE CASCADE,
  event_note text NOT NULL
);

INSERT INTO public.canonical_sessions(
  id,team_id,session_type,title,idempotency_key,created_by
) VALUES
 (
  'de100000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'training','DRG-01 backup fixture',
  'de200000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001'
 ),
 (
  'de100000-0000-0000-0000-000000000002',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'training','DRG-01 Bravo fixture',
  'de200000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002'
 );

INSERT INTO public.drg_backup_fixture(id,team_id,canonical_session_id) VALUES
 ('de300000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','de100000-0000-0000-0000-000000000001'),
 ('de300000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'de100000-0000-0000-0000-000000000002');
INSERT INTO public.drg_backup_fixture_events(id,fixture_id,event_note) VALUES
 ('de400000-0000-0000-0000-000000000001','de300000-0000-0000-0000-000000000001','Alpha child event'),
 ('de400000-0000-0000-0000-000000000002','de300000-0000-0000-0000-000000000002','Bravo child event');
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261121010000_drg_01_complete_team_backup.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TEMP TABLE drg_backup_result(payload jsonb);
CREATE TEMP TABLE drg_restore_result(payload jsonb);
GRANT INSERT, SELECT ON drg_backup_result, drg_restore_result TO authenticated;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
INSERT INTO drg_backup_result(payload)
SELECT public.get_team_backup_for_team('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

DO $export$
DECLARE
  backup jsonb;
  coverage jsonb;
BEGIN
  SELECT payload INTO backup FROM drg_backup_result;
  coverage:=backup->'coverage_report';
  IF backup->>'schema_version'<>'2' THEN RAISE EXCEPTION 'DRG-01 export version is not 2'; END IF;
  IF COALESCE((coverage->>'complete')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'DRG-01 expected complete export, got coverage: %',coverage;
  END IF;
  IF NOT (coverage->'included_tables' ? 'canonical_sessions')
    OR NOT (coverage->'included_tables' ? 'canonical_session_result_versions')
    OR NOT (coverage->'included_tables' ? 'daily_scores')
    OR NOT (coverage->'included_tables' ? 'daily_score_feedback')
    OR NOT (coverage->'included_tables' ? 'practice_plans')
    OR NOT (coverage->'included_tables' ? 'training_results')
    OR NOT (coverage->'included_tables' ? 'scrim_records')
    OR NOT (coverage->'included_tables' ? 'tournament_matches') THEN
    RAISE EXCEPTION 'DRG-01 required team/player/Evolution tables are missing from manifest';
  END IF;
  IF jsonb_array_length(backup->'tables'->'drg_backup_fixture')<>1
    OR jsonb_array_length(backup->'tables'->'drg_backup_fixture_events')<>1 THEN
    RAISE EXCEPTION 'DRG-01 FK-only child discovery or team scoping failed';
  END IF;
  IF backup->'tables'->'drg_backup_fixture'->0->>'id'<>'de300000-0000-0000-0000-000000000001'
    OR backup->'tables'->'drg_backup_fixture_events'->0->>'id'<>'de400000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'DRG-01 original fixture IDs were not preserved in export';
  END IF;
  IF (coverage->'row_counts'->>'canonical_sessions')::integer<1 THEN
    RAISE EXCEPTION 'DRG-01 canonical session history was not exported';
  END IF;
  IF (coverage->'row_counts'->>'daily_scores')::integer<>1
    OR (coverage->'row_counts'->>'daily_score_feedback')::integer<>1
    OR (coverage->'row_counts'->>'daily_drills')::integer<>1
    OR (coverage->'row_counts'->>'team_ratings')::integer<>1 THEN
    RAISE EXCEPTION 'DRG-01 persisted player scoring/evaluation history was not exported';
  END IF;
END
$export$;

-- A changed table value with the same row count must fail checksum validation before deletion.
DO $tamper$
DECLARE
  corrupted jsonb;
  rejected boolean := false;
BEGIN
  SELECT payload INTO corrupted FROM drg_backup_result;
  corrupted:=pg_catalog.jsonb_set(
    corrupted,
    '{tables,drg_backup_fixture_events,0,event_note}',
    pg_catalog.to_jsonb('tampered event'::text),
    false
  );
  BEGIN
    PERFORM public.restore_team_backup_for_team(
      corrupted,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'DRG-01 corrupted payload was not rejected'; END IF;
END
$tamper$;

-- Restore Alpha's own backup over its existing rows, retaining its authenticated owner and proving Bravo remains isolated.
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
INSERT INTO drg_restore_result(payload)
SELECT public.restore_team_backup_for_team(
  (SELECT payload FROM drg_backup_result),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
);

DO $restore$
DECLARE
  result jsonb;
BEGIN
  SELECT payload INTO result FROM drg_restore_result;
  IF COALESCE((result->>'complete')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'DRG-01 restore did not report complete';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.drg_backup_fixture
    WHERE id='de300000-0000-0000-0000-000000000001'
      AND team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      AND canonical_session_id='de100000-0000-0000-0000-000000000001'
  ) THEN RAISE EXCEPTION 'DRG-01 parent IDs or team remapping were not preserved'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.drg_backup_fixture_events
    WHERE id='de400000-0000-0000-0000-000000000001'
      AND fixture_id='de300000-0000-0000-0000-000000000001'
  ) THEN RAISE EXCEPTION 'DRG-01 FK-only child record was not restored'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      AND user_id='10000000-0000-0000-0000-000000000001'
      AND membership_role='owner' AND status='active'
  ) THEN RAISE EXCEPTION 'DRG-01 current team owner identity was not retained'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daily_scores WHERE id='de500000-0000-0000-0000-000000000001' AND team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    OR NOT EXISTS (SELECT 1 FROM public.daily_score_feedback WHERE id='de500000-0000-0000-0000-000000000002' AND score_id='de500000-0000-0000-0000-000000000001')
    OR NOT EXISTS (SELECT 1 FROM public.daily_drills WHERE id='de500000-0000-0000-0000-000000000003' AND team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    OR NOT EXISTS (SELECT 1 FROM public.team_ratings WHERE id='de500000-0000-0000-0000-000000000004' AND team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') THEN
    RAISE EXCEPTION 'DRG-01 persisted player scoring/evaluation history did not survive restore';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_sessions
    WHERE id='de100000-0000-0000-0000-000000000001'
      AND team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ) THEN RAISE EXCEPTION 'DRG-01 canonical Evolution session ID/team mapping failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.drg_backup_fixture WHERE id='de300000-0000-0000-0000-000000000002' AND team_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') THEN
    RAISE EXCEPTION 'DRG-01 restore crossed into another team';
  END IF;
END
$restore$;

-- A partially deployed optional Phase 3 schema must never be reported as complete.
RESET ROLE;
CREATE TABLE public.evolution_rubric_versions (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id)
);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $partial$
DECLARE backup jsonb;
BEGIN
  backup:=public.get_team_backup_for_team('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  IF COALESCE((backup->'coverage_report'->>'complete')::boolean,true) IS NOT FALSE THEN
    RAISE EXCEPTION 'DRG-01 partial Phase 3 schema was silently reported complete';
  END IF;
  IF COALESCE((backup->'coverage_report'->>'phase_three_schema_present')::boolean,false) IS NOT TRUE
    OR jsonb_array_length(backup->'coverage_report'->'missing_phase_three_candidate_tables')=0 THEN
    RAISE EXCEPTION 'DRG-01 partial Phase 3 coverage report is incomplete';
  END IF;
END
$partial$;

SELECT 'DRG-01 complete team backup export/restore PostgreSQL integration PASS' AS verification;
SQL
