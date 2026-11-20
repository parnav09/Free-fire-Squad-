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
END
$export$;

-- Restore Alpha's complete graph over Bravo, retaining Bravo's authenticated owner identity.
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
INSERT INTO drg_restore_result(payload)
SELECT public.restore_team_backup_for_team(
  (SELECT payload FROM drg_backup_result),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
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
      AND team_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      AND canonical_session_id='de100000-0000-0000-0000-000000000001'
  ) THEN RAISE EXCEPTION 'DRG-01 parent IDs or team remapping were not preserved'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.drg_backup_fixture_events
    WHERE id='de400000-0000-0000-0000-000000000001'
      AND fixture_id='de300000-0000-0000-0000-000000000001'
  ) THEN RAISE EXCEPTION 'DRG-01 FK-only child record was not restored'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      AND user_id='20000000-0000-0000-0000-000000000002'
      AND membership_role='owner' AND status='active'
  ) THEN RAISE EXCEPTION 'DRG-01 current target owner identity was not retained'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_sessions
    WHERE id='de100000-0000-0000-0000-000000000001'
      AND team_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ) THEN RAISE EXCEPTION 'DRG-01 canonical Evolution session ID/team mapping failed'; END IF;
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
