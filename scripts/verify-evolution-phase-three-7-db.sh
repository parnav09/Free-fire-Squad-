#!/usr/bin/env bash
set -euo pipefail
: "\${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122180000_evolution_phase_three_7_not_observed_missing_data_rules.sql"
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-three-6-db.sh"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000007',false);
DO $$
DECLARE
  v_team uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_context uuid; v_set uuid; v_dim text; v_def integer;
  v_dim2 text; v_def2 integer; v_ev uuid; v_ev2 uuid;
  v_state text; v_rating integer; v_missing integer; v_no integer; v_rejected integer;
BEGIN
  SELECT wb.evaluation_context_id,wb.weight_set_id INTO v_context,v_set
  FROM public.evolution_evaluation_role_weight_bindings wb
  JOIN public.evolution_role_weight_sets ws ON ws.id=wb.weight_set_id
  WHERE wb.team_id=v_team AND ws.lifecycle_status='active'
  ORDER BY wb.bound_at DESC LIMIT 1;
  IF v_context IS NULL THEN RAISE EXCEPTION 'Active Phase 3.6 context fixture missing'; END IF;
  SELECT dimension_key,dimension_definition_version INTO v_dim,v_def
  FROM public.evolution_role_dimension_weights WHERE weight_set_id=v_set ORDER BY dimension_key LIMIT 1;
  SELECT dimension_key,dimension_definition_version INTO v_dim2,v_def2
  FROM public.evolution_role_dimension_weights WHERE weight_set_id=v_set AND dimension_key<>v_dim ORDER BY dimension_key LIMIT 1;
  IF v_dim IS NULL OR v_dim2 IS NULL THEN RAISE EXCEPTION 'Need two applicable dimensions for 3.7 integration'; END IF;

  INSERT INTO public.evolution_evidence_items(team_id,evaluation_context_id,visibility,status,source_type,title,observation,created_by)
  VALUES(v_team,v_context,'team','pending','manual_observation','Phase 3.7 zero rating','Observed evidence for valid zero.',auth.uid()) RETURNING id INTO v_ev;
  INSERT INTO public.evolution_evidence_dimension_links(team_id,evidence_item_id,dimension_key,definition_version,created_by)
  VALUES(v_team,v_ev,v_dim,v_def,auth.uid());
  INSERT INTO public.evolution_evaluation_dimension_assessment_events(
    team_id,evaluation_context_id,dimension_key,dimension_definition_version,revision_number,
    assessment_state,rating_value,evidence_item_id,actor_user_id)
  VALUES(v_team,v_context,v_dim,v_def,1,'observed',0,v_ev,auth.uid());

  INSERT INTO public.evolution_evaluation_dimension_assessment_events(
    team_id,evaluation_context_id,dimension_key,dimension_definition_version,revision_number,
    assessment_state,reason,actor_user_id)
  SELECT v_team,v_context,w.dimension_key,w.dimension_definition_version,1,
    'not_observed','No reliable observation was available.',auth.uid()
  FROM public.evolution_role_dimension_weights w
  WHERE w.weight_set_id=v_set AND w.dimension_key<>v_dim AND w.dimension_key<>v_dim2;

  SELECT rating_value INTO v_rating FROM public.evolution_evaluation_current_dimension_assessments
  WHERE evaluation_context_id=v_context AND dimension_key=v_dim;
  IF v_rating IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Zero rating was lost or coerced'; END IF;
  SELECT missing_dimension_count,not_observed_dimension_count,assessment_status
    INTO v_missing,v_no,v_state FROM public.evolution_evaluation_assessment_readiness
  WHERE evaluation_context_id=v_context;
  IF v_missing<>1 OR v_no<1 OR v_state<>'provisional' THEN
    RAISE EXCEPTION 'Not Observed / pending evidence readiness mismatch: %, %, %',v_missing,v_no,v_state;
  END IF;

  BEGIN
    INSERT INTO public.evolution_evaluation_dimension_assessment_events(
      team_id,evaluation_context_id,dimension_key,dimension_definition_version,revision_number,
      assessment_state,reason,actor_user_id)
    VALUES(v_team,v_context,v_dim,v_def,2,'not_applicable','Invalid applicability test.',auth.uid());
    RAISE EXCEPTION 'Applicable dimension accepted Not Applicable';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.evolution_evaluation_dimension_assessment_events(
      team_id,evaluation_context_id,dimension_key,dimension_definition_version,revision_number,
      assessment_state,reason,actor_user_id)
    VALUES(v_team,v_context,v_dim,v_def,2,'observed','NULL rating must be rejected.',auth.uid());
    RAISE EXCEPTION 'Observed NULL rating accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  INSERT INTO public.evolution_evidence_items(team_id,evaluation_context_id,visibility,status,source_type,title,observation,created_by)
  VALUES(v_team,v_context,'team','pending','manual_observation','Phase 3.7 rejected evidence','Evidence to reject.',auth.uid()) RETURNING id INTO v_ev2;
  INSERT INTO public.evolution_evidence_dimension_links(team_id,evidence_item_id,dimension_key,definition_version,created_by)
  VALUES(v_team,v_ev2,v_dim2,v_def2,auth.uid());
END $$;

-- The disposable database owner exercises the append-only provenance transition;
-- the production RPC continues to enforce coach-only, no-self-verification rules.
RESET ROLE;
SET ROLE postgres;
INSERT INTO public.evolution_evidence_verification_events(team_id,evidence_item_id,from_status,to_status,actor_user_id,reason)
SELECT e.team_id,e.id,'pending','rejected','80000000-0000-0000-0000-000000000008','Rejected in integration test.'
FROM public.evolution_evidence_items e WHERE e.title='Phase 3.7 rejected evidence';
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000007',false);
DO $$
DECLARE
  v_team uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_context uuid; v_dim text; v_def integer; v_ev uuid; v_state text; v_rejected integer;
BEGIN
  SELECT wb.evaluation_context_id INTO v_context
  FROM public.evolution_evaluation_role_weight_bindings wb
  JOIN public.evolution_role_weight_sets ws ON ws.id=wb.weight_set_id
  WHERE ws.lifecycle_status='active' ORDER BY wb.bound_at DESC LIMIT 1;
  SELECT w.dimension_key,w.dimension_definition_version INTO v_dim,v_def
  FROM public.evolution_role_dimension_weights w
  WHERE w.weight_set_id=(SELECT weight_set_id FROM public.evolution_evaluation_role_weight_bindings WHERE evaluation_context_id=v_context)
    AND w.dimension_key<>(SELECT dimension_key FROM public.evolution_evaluation_dimension_assessment_events
      WHERE evaluation_context_id=v_context AND assessment_state='observed' ORDER BY created_at LIMIT 1)
  ORDER BY w.dimension_key LIMIT 1;
  SELECT id INTO v_ev FROM public.evolution_evidence_items WHERE title='Phase 3.7 rejected evidence';
  INSERT INTO public.evolution_evaluation_dimension_assessment_events(
    team_id,evaluation_context_id,dimension_key,dimension_definition_version,revision_number,
    assessment_state,evidence_item_id,reason,actor_user_id)
  VALUES(v_team,v_context,v_dim,v_def,2,'rejected_evidence',v_ev,'Evidence was rejected.',auth.uid());
  SELECT rejected_evidence_dimension_count,assessment_status INTO v_rejected,v_state
  FROM public.evolution_evaluation_assessment_readiness WHERE evaluation_context_id=v_context;
  IF v_rejected<>1 OR v_state<>'provisional' THEN RAISE EXCEPTION 'Rejected evidence not separated'; END IF;
  INSERT INTO public.evolution_evaluation_dimension_assessment_events(
    team_id,evaluation_context_id,dimension_key,dimension_definition_version,revision_number,
    assessment_state,reason,actor_user_id)
  VALUES(v_team,v_context,v_dim,v_def,3,'not_observed','No valid observation remains.',auth.uid());
END $$;

RESET ROLE;
SET ROLE postgres;
INSERT INTO public.evolution_evidence_verification_events(team_id,evidence_item_id,from_status,to_status,actor_user_id)
SELECT e.team_id,e.id,'pending','verified','80000000-0000-0000-0000-000000000008'
FROM public.evolution_evidence_items e WHERE e.title='Phase 3.7 zero rating';
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000007',false);
DO $$
DECLARE v_status text; v_missing integer; v_not_observed integer;
BEGIN
  SELECT assessment_status,missing_dimension_count,not_observed_dimension_count
    INTO v_status,v_missing,v_not_observed
  FROM public.evolution_evaluation_assessment_readiness
  WHERE evaluation_context_id=(SELECT evaluation_context_id
    FROM public.evolution_evaluation_role_weight_bindings wb
    JOIN public.evolution_role_weight_sets ws ON ws.id=wb.weight_set_id
    WHERE ws.lifecycle_status='active' ORDER BY wb.bound_at DESC LIMIT 1);
  IF v_status<>'final' OR v_missing<>0 OR v_not_observed<1 THEN
    RAISE EXCEPTION 'Verified observation plus explicit Not Observed should be final: %, %, %',v_status,v_missing,v_not_observed;
  END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.evolution_evaluation_dimension_assessment_events','UPDATE')
    OR has_table_privilege('authenticated','public.evolution_evaluation_dimension_assessment_events','DELETE')
    OR has_table_privilege('anon','public.evolution_evaluation_dimension_assessment_events','SELECT')
  THEN RAISE EXCEPTION 'Assessment event ACLs are too permissive'; END IF;
END $$;
SELECT 'Evolution Phase 3.7 Not Observed & Missing Data PostgreSQL PASS' AS result;
SQL
