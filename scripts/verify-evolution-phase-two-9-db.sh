#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Replay all accepted parent contracts and Point 2.8 before adding Point 2.9.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-two-8-db.sh"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261120230000_evolution_phase_two_9_existing_module_integration.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- Phase 2.2 starts from minimal source-table fixtures. Add only the Planning/Training
-- columns required to exercise the Point 2.9 explicit promotion adapter.
CREATE TABLE public.practice_plans (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  title text NOT NULL,
  plan_date date NOT NULL,
  plan_type text NOT NULL,
  focus text NOT NULL DEFAULT '',
  objectives text[] NOT NULL DEFAULT '{}',
  planned_minutes integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'scheduled'
);
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.practice_plans(id),
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Training fixture',
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'squad',
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
SQL
INSERT INTO public.scrim_records(id,team_id,owner_id,scrim_date,match_count,matches)
VALUES (
  'aa290000-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '10000000-0000-0000-0000-000000000001',
  DATE '2026-11-24',3,
  '[{"placement":2,"kills":4},{"placement":1,"kills":7},{"placement":5,"kills":2}]'::jsonb
);

INSERT INTO public.tournament_cycles(id,team_id,cycle_start,cycle_end,title,status,created_by)
VALUES (
  'aa290000-0000-0000-0000-000000000002',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  DATE '2026-11-24',DATE '2026-11-30','Phase 2.9 Tournament Fixture','active',
  '10000000-0000-0000-0000-000000000001'
);
INSERT INTO public.tournament_matches(id,cycle_id,team_id,match_day,match_number,placement,kills,points,status,recorded_by)
VALUES
 ('aa290000-0000-0000-0000-000000000011','aa290000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,1,2,4,13,'draft','10000000-0000-0000-0000-000000000001'),
 ('aa290000-0000-0000-0000-000000000012','aa290000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,2,1,7,19,'draft','10000000-0000-0000-0000-000000000001');

INSERT INTO public.practice_plans(id,team_id,title,plan_date,plan_type,focus,objectives,planned_minutes,created_by,status)
VALUES (
  'aa290000-0000-0000-0000-000000000003',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Phase 2.9 planned session',
  DATE '2026-11-24','daily','Rotation discipline',ARRAY['Zone timing','Comms checks'],90,
  '10000000-0000-0000-0000-000000000001','scheduled'
);
INSERT INTO public.training_sessions(id,team_id,plan_id,title,session_type,scheduled_at,duration_minutes,instructions,created_by)
VALUES (
  'aa290000-0000-0000-0000-000000000021',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',NULL,'Standalone training fixture','squad',
  '2026-11-24T06:30:00Z',30,'Explicit training evidence fixture',
  '10000000-0000-0000-0000-000000000001'
),(
  'aa290000-0000-0000-0000-000000000022',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aa290000-0000-0000-0000-000000000003',
  'Promoted plan fixture','squad','2026-11-24T06:30:00Z',90,
  'Rotation discipline; Zone timing; Comms checks',
  '10000000-0000-0000-0000-000000000001'
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);

DO $phase29$
DECLARE
  s record;
  s_retry record;
  t record;
  tr record;
  p record;
  n integer;
BEGIN
  SELECT * INTO s FROM public.integrate_canonical_source(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','scrim','aa290000-0000-0000-0000-000000000001'
  );
  SELECT * INTO s_retry FROM public.integrate_canonical_source(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','scrim','aa290000-0000-0000-0000-000000000001'
  );
  IF s.canonical_session_id IS NULL OR s_retry.canonical_session_id<>s.canonical_session_id
    OR s.synced_match_count<>3 OR s_retry.synced_match_count<>0
  THEN RAISE EXCEPTION 'Scrim adapter is not idempotent or did not map all three match IDs'; END IF;
  SELECT count(*) INTO n FROM public.canonical_session_sources
    WHERE source_system='scrim' AND source_record_id='aa290000-0000-0000-0000-000000000001';
  IF n<>1 THEN RAISE EXCEPTION 'Scrim source mapped to more than one canonical session'; END IF;
  SELECT count(*) INTO n FROM public.canonical_session_matches
    WHERE canonical_session_id=s.canonical_session_id AND source_system='scrim';
  IF n<>3 THEN RAISE EXCEPTION 'Scrim canonical match mapping is incomplete'; END IF;

  SELECT * INTO t FROM public.integrate_canonical_source(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','tournament','aa290000-0000-0000-0000-000000000002'
  );
  IF t.canonical_session_id IS NULL OR t.synced_match_count<>2
  THEN RAISE EXCEPTION 'Tournament adapter did not map its two persisted match rows'; END IF;
  SELECT count(*) INTO n FROM public.canonical_session_matches
    WHERE canonical_session_id=t.canonical_session_id AND source_system='tournament';
  IF n<>2 THEN RAISE EXCEPTION 'Tournament canonical match mapping is incomplete'; END IF;

  SELECT * INTO tr FROM public.integrate_canonical_source(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','training','aa290000-0000-0000-0000-000000000021'
  );
  IF tr.canonical_session_id IS NULL OR tr.synced_match_count<>0
  THEN RAISE EXCEPTION 'Training adapter must create a session identity without competitive matches'; END IF;
  SELECT count(*) INTO n FROM public.canonical_session_matches
    WHERE canonical_session_id=tr.canonical_session_id;
  IF n<>0 THEN RAISE EXCEPTION 'Training source generated phantom competitive matches'; END IF;

  SELECT * INTO p FROM public.integrate_canonical_source(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','training','aa290000-0000-0000-0000-000000000022'
  );
  IF p.canonical_session_id IS NULL OR p.synced_match_count<>0
  THEN RAISE EXCEPTION 'Explicitly promoted Planning item did not become a Training session identity'; END IF;
  SELECT count(*) INTO n FROM public.canonical_session_sources
    WHERE source_system='training' AND source_record_id='aa290000-0000-0000-0000-000000000022';
  IF n<>1 THEN RAISE EXCEPTION 'Promoted plan Training session mapping is missing'; END IF;
  SELECT count(*) INTO n FROM public.canonical_session_sources
    WHERE source_record_id='aa290000-0000-0000-0000-000000000003';
  IF n<>0 THEN RAISE EXCEPTION 'Planning plan itself was incorrectly promoted as a played session'; END IF;
END $phase29$;
RESET ROLE;

-- A regular player cannot create canonical mappings for staff-managed sources.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.integrate_canonical_source(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','scrim','aa290000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'Player unexpectedly integrated a staff-managed canonical source';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Verify RPC privilege surface.
DO $$
BEGIN
  IF has_function_privilege('anon','public.integrate_canonical_source(uuid,text,uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.integrate_canonical_source(uuid,text,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Canonical integration RPC ACLs are not restricted to authenticated'; END IF;
END $$;

SELECT 'Evolution Phase 2.9 PostgreSQL integration PASS' AS verification;
SQL
