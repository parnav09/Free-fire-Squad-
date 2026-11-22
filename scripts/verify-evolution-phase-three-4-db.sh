#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122150000_evolution_phase_three_4_evidence_provenance_verification.sql"

# Recreate and verify the Phase 2.2–2.6, Phase 3.2 and Phase 3.3
# dependencies plus their disposable fixtures. Never targets production.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-three-3-db.sh"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000007',false);

DO $$
DECLARE
  v_evidence uuid;
  v_context uuid;
  v_duplicate uuid;
  v_version uuid;
  v_status text;
  v_count integer;
BEGIN
  SELECT id INTO v_evidence
  FROM public.evolution_evidence_items
  WHERE title='Rotation timing' AND visibility='team'
  ORDER BY created_at
  LIMIT 1;
  IF v_evidence IS NULL THEN RAISE EXCEPTION 'Phase 3.3 evidence fixture missing'; END IF;

  SELECT status INTO v_status
  FROM public.evolution_evidence_current_status
  WHERE evidence_item_id=v_evidence;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'initial evidence status was not backfilled as pending'; END IF;

  -- Coach can verify evidence authored by another member.
  PERFORM public.transition_evolution_evidence_status(v_evidence,'verified','Reviewed against the match context',NULL);
  SELECT status INTO v_status
  FROM public.evolution_evidence_current_status WHERE evidence_item_id=v_evidence;
  IF v_status <> 'verified' THEN RAISE EXCEPTION 'verified transition did not become current'; END IF;

  -- Append a correction version, then record the correction event referencing it.
  INSERT INTO public.evolution_evidence_versions(
    team_id,evidence_item_id,version_number,source_type,title,observation,created_by
  )
  SELECT e.team_id,e.id,3,'manual_observation','Rotation timing corrected',
    'The call was made before the team crossed the ridge.',auth.uid()
  FROM public.evolution_evidence_items e WHERE e.id=v_evidence
  RETURNING id INTO v_version;

  PERFORM public.transition_evolution_evidence_status(
    v_evidence,'corrected','Original observation amended after review',v_version
  );
  SELECT status INTO v_status
  FROM public.evolution_evidence_current_status WHERE evidence_item_id=v_evidence;
  IF v_status <> 'corrected' THEN RAISE EXCEPTION 'corrected transition did not become current'; END IF;

  PERFORM public.transition_evolution_evidence_status(v_evidence,'pending',NULL,NULL);
  SELECT status INTO v_status
  FROM public.evolution_evidence_current_status WHERE evidence_item_id=v_evidence;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'corrected evidence did not return to pending review'; END IF;

  SELECT count(*) INTO v_count
  FROM public.evolution_evidence_verification_events
  WHERE evidence_item_id=v_evidence;
  IF v_count <> 4 THEN RAISE EXCEPTION 'expected initial + three transitions, got %',v_count; END IF;

  -- Archival is reason-backed and terminal.
  PERFORM public.transition_evolution_evidence_status(v_evidence,'archived','Evidence retained for historical audit');
  SELECT status INTO v_status
  FROM public.evolution_evidence_current_status WHERE evidence_item_id=v_evidence;
  IF v_status <> 'archived' THEN RAISE EXCEPTION 'archival transition did not become current'; END IF;
  BEGIN
    PERFORM public.transition_evolution_evidence_status(v_evidence,'pending',NULL,NULL);
    RAISE EXCEPTION 'archived evidence unexpectedly reopened';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Rejection without a reason must fail.
  BEGIN
    PERFORM public.transition_evolution_evidence_status(v_evidence,'rejected',NULL,NULL);
    RAISE EXCEPTION 'rejection without reason unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Private evidence remains author-only and cannot be adjudicated by a coach.
  BEGIN
    PERFORM public.transition_evolution_evidence_status(
      'e3000000-0000-0000-0000-000000000003','verified','Should be denied',NULL
    );
    RAISE EXCEPTION 'coach unexpectedly adjudicated private evidence';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- A coach cannot write a raw verification event around the RPC.
  BEGIN
    INSERT INTO public.evolution_evidence_verification_events(
      team_id,evidence_item_id,from_status,to_status,actor_user_id
    ) SELECT team_id,id,'pending','verified',auth.uid()
      FROM public.evolution_evidence_items WHERE id=v_evidence;
    RAISE EXCEPTION 'direct verification event insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Duplicate lookup is advisory and returns candidates without merging them.
  SELECT evaluation_context_id INTO v_context
  FROM public.evolution_evidence_items WHERE id=v_evidence;
  INSERT INTO public.evolution_evidence_items(
    team_id,evaluation_context_id,visibility,source_type,title,observation,created_by
  )
  SELECT team_id,evaluation_context_id,'team','manual_observation',
    'Rotation timing','Potential duplicate observation.',auth.uid()
  FROM public.evolution_evidence_items WHERE id=v_evidence
  RETURNING id INTO v_duplicate;

  SELECT count(*) INTO v_count
  FROM public.find_evolution_evidence_duplicate_candidates(v_duplicate)
  WHERE candidate_evidence_id=v_evidence
    AND match_reason='same_context_source_and_title';
  IF v_count <> 1 THEN RAISE EXCEPTION 'duplicate candidate was not detected'; END IF;

  SELECT count(*) INTO v_count
  FROM public.evolution_evidence_items
  WHERE id IN (v_evidence,v_duplicate);
  IF v_count <> 2 THEN RAISE EXCEPTION 'duplicate detection destructively merged evidence'; END IF;
END $$;

-- Evidence author cannot verify their own item, even if the author is an owner.
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE v_evidence uuid;
BEGIN
  SELECT id INTO v_evidence FROM public.evolution_evidence_items
  WHERE title='Rotation timing' AND visibility='team' ORDER BY created_at LIMIT 1;
  BEGIN
    PERFORM public.transition_evolution_evidence_status(v_evidence,'verified','Self review',NULL);
    RAISE EXCEPTION 'author self-verification unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Ordinary player cannot verify evidence.
SELECT set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000008',false);
DO $$
DECLARE v_evidence uuid;
BEGIN
  SELECT id INTO v_evidence FROM public.evolution_evidence_items
  WHERE title='Rotation timing' AND visibility='team' ORDER BY created_at LIMIT 1;
  BEGIN
    PERFORM public.transition_evolution_evidence_status(v_evidence,'verified','Player attempt',NULL);
    RAISE EXCEPTION 'player verification unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.evolution_evidence_verification_events','INSERT')
    OR has_table_privilege('authenticated','public.evolution_evidence_verification_events','UPDATE')
    OR has_table_privilege('authenticated','public.evolution_evidence_verification_events','DELETE')
  THEN RAISE EXCEPTION 'authenticated role has direct verification event write privileges'; END IF;
  IF has_function_privilege('anon','public.transition_evolution_evidence_status(uuid,text,text,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'anonymous role can execute evidence transition RPC'; END IF;
  IF has_function_privilege('anon','public.find_evolution_evidence_duplicate_candidates(uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'anonymous role can execute duplicate lookup'; END IF;
END $$;

SELECT 'Evolution Phase 3.4 evidence provenance PostgreSQL PASS' AS result;
SQL
