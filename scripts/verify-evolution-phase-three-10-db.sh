#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122200000_evolution_phase_three_10_score_snapshot_history.sql"

# Build the isolated Phase 3.2–3.8 dependency chain and its verified fixtures.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-three-8-db.sh"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TEMP TABLE phase_310_verified_evidence (id uuid PRIMARY KEY);
CREATE TEMP TABLE phase_310_contexts (kind text PRIMARY KEY, id uuid NOT NULL);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000007',false);

DO $$
DECLARE
  v_context uuid;
  v_team uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_set uuid;
  v_role uuid;
  v_rubric uuid;
  v_dim record;
  v_evidence uuid;
  v_revision integer;
  v_rating integer := 6;
BEGIN
  SELECT wb.evaluation_context_id,wb.weight_set_id,wb.role_assignment_id,rb.rubric_version_id
    INTO v_context,v_set,v_role,v_rubric
  FROM public.evolution_evaluation_role_weight_bindings wb
  JOIN public.evolution_role_weight_sets ws ON ws.id=wb.weight_set_id
  JOIN public.evolution_evaluation_rubric_bindings rb
    ON rb.evaluation_context_id=wb.evaluation_context_id AND rb.team_id=wb.team_id
  WHERE wb.team_id=v_team AND ws.lifecycle_status='active'
  ORDER BY wb.bound_at DESC LIMIT 1;
  IF v_context IS NULL THEN RAISE EXCEPTION 'Phase 3.10 active evaluation fixture missing'; END IF;

  INSERT INTO phase_310_contexts(kind,id) VALUES('final',v_context);

  -- Give every applicable dimension a fresh, exact-context evidence reference
  -- and an explicit observed assessment. The verification events are appended
  -- by the disposable database owner in the next SQL block.
  FOR v_dim IN
    SELECT w.dimension_key,w.dimension_definition_version
    FROM public.evolution_role_dimension_weights w
    WHERE w.weight_set_id=v_set AND w.team_id=v_team
    ORDER BY w.dimension_key
  LOOP
    INSERT INTO public.evolution_evidence_items(
      team_id,evaluation_context_id,visibility,status,source_type,title,observation,created_by
    ) VALUES (
      v_team,v_context,'team','pending','manual_observation',
      'Phase 3.10 verified fixture '||v_dim.dimension_key,
      'Immutable integration evidence for deterministic score snapshot history.',
      auth.uid()
    ) RETURNING id INTO v_evidence;

    INSERT INTO public.evolution_evidence_dimension_links(
      team_id,evidence_item_id,dimension_key,definition_version,created_by
    ) VALUES(v_team,v_evidence,v_dim.dimension_key,v_dim.dimension_definition_version,auth.uid());

    SELECT coalesce(max(revision_number),0)+1 INTO v_revision
    FROM public.evolution_evaluation_dimension_assessment_events
    WHERE evaluation_context_id=v_context AND dimension_key=v_dim.dimension_key;

    INSERT INTO public.evolution_evaluation_dimension_assessment_events(
      team_id,evaluation_context_id,dimension_key,dimension_definition_version,
      revision_number,assessment_state,rating_value,evidence_item_id,actor_user_id
    ) VALUES(
      v_team,v_context,v_dim.dimension_key,v_dim.dimension_definition_version,
      v_revision,'observed',v_rating,v_evidence,auth.uid()
    );

    INSERT INTO phase_310_verified_evidence(id) VALUES(v_evidence);
  END LOOP;
END $$;

RESET ROLE;
SET ROLE postgres;
INSERT INTO public.evolution_evidence_verification_events(
  team_id,evidence_item_id,from_status,to_status,actor_user_id,evidence_version_id
)
SELECT e.team_id,e.id,'pending','verified',
  '80000000-0000-0000-0000-000000000008',ev.id
FROM public.evolution_evidence_items e
JOIN phase_310_verified_evidence fixture ON fixture.id=e.id
JOIN public.evolution_evidence_versions ev
  ON ev.evidence_item_id=e.id AND ev.team_id=e.team_id AND ev.version_number=1;

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000007',false);

DO $$
DECLARE
  v_context uuid;
  v_snapshot_one uuid;
  v_snapshot_repeat uuid;
  v_snapshot_two uuid;
  v_provisional_context uuid;
  v_insufficient_context uuid;
  v_provisional_snapshot uuid;
  v_insufficient_snapshot uuid;
  v_team uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_set uuid;
  v_role uuid;
  v_rubric uuid;
  v_player_member uuid;
  v_player_user uuid;
  v_session uuid;
  v_match uuid;
  v_dimension text;
  v_definition integer;
  v_evidence uuid;
  v_revision integer;
  v_old_score numeric(5,2);
  v_new_score numeric(5,2);
  v_status text;
  v_previous uuid;
  v_input jsonb;
BEGIN
  SELECT id INTO v_context FROM phase_310_contexts WHERE kind='final';
  v_snapshot_one := public.calculate_evolution_player_score_snapshot(v_context);
  v_snapshot_repeat := public.calculate_evolution_player_score_snapshot(v_context);
  IF v_snapshot_one IS NULL OR v_snapshot_one IS DISTINCT FROM v_snapshot_repeat THEN
    RAISE EXCEPTION 'Identical score inputs must return the same idempotent snapshot';
  END IF;

  SELECT score_status,score100,score_basis_points,input_snapshot
    INTO v_status,v_old_score,v_dimension,v_input
  FROM public.evolution_player_score_snapshots WHERE id=v_snapshot_one;
  IF v_status<>'final' OR v_old_score IS DISTINCT FROM 60.00::numeric
    OR v_input->>'calculation_version'<>'deterministic-scoring-v1'
    OR jsonb_array_length(v_input->'weights')=0
    OR jsonb_array_length(v_input->'assessments')=0 THEN
    RAISE EXCEPTION 'Final score snapshot or raw historical inputs were not persisted';
  END IF;

  SELECT w.dimension_key,w.dimension_definition_version,a.evidence_item_id,
         a.revision_number,a.rating_value
    INTO v_dimension,v_definition,v_evidence,v_revision,v_old_score
  FROM public.evolution_role_dimension_weights w
  JOIN public.evolution_evaluation_current_dimension_assessments a
    ON a.evaluation_context_id=v_context AND a.dimension_key=w.dimension_key
  WHERE w.weight_set_id=(SELECT weight_set_id FROM public.evolution_player_score_snapshots WHERE id=v_snapshot_one)
    AND w.weight_basis_points>0
  ORDER BY w.dimension_key LIMIT 1;

  INSERT INTO public.evolution_evaluation_dimension_assessment_events(
    team_id,evaluation_context_id,dimension_key,dimension_definition_version,
    revision_number,assessment_state,rating_value,evidence_item_id,actor_user_id
  ) VALUES(
    v_team,v_context,v_dimension,v_definition,v_revision+1,
    'observed',CASE WHEN v_old_score=10 THEN 9 ELSE 10 END,
    v_evidence,auth.uid()
  );

  BEGIN
    PERFORM public.calculate_evolution_player_score_snapshot(v_context);
    RAISE EXCEPTION 'Changed inputs unexpectedly recalculated without a reason';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  v_snapshot_two := public.calculate_evolution_player_score_snapshot(
    v_context,'Corrected assessment rating after coach review.'
  );
  IF v_snapshot_two IS NULL OR v_snapshot_two=v_snapshot_one THEN
    RAISE EXCEPTION 'Changed inputs must append a new score snapshot';
  END IF;

  SELECT score100,previous_snapshot_id,recalculation_reason,input_snapshot
    INTO v_new_score,v_previous,v_input,v_input
  FROM public.evolution_player_score_snapshots WHERE id=v_snapshot_two;
  IF v_previous IS DISTINCT FROM v_snapshot_one
    OR v_new_score IS NOT DISTINCT FROM 60.00::numeric
    OR v_input IS NULL THEN
    RAISE EXCEPTION 'Recalculation history chain or changed score was not retained';
  END IF;

  v_snapshot_repeat := public.calculate_evolution_player_score_snapshot(
    v_context,'This retry must remain idempotent.'
  );
  IF v_snapshot_repeat IS DISTINCT FROM v_snapshot_two THEN
    RAISE EXCEPTION 'Repeated recalculation with identical inputs must be idempotent';
  END IF;

  IF (SELECT score100 FROM public.evolution_player_score_snapshots WHERE id=v_snapshot_one)
    IS DISTINCT FROM 60.00::numeric THEN
    RAISE EXCEPTION 'Prior immutable score snapshot changed after recalculation';
  END IF;

  -- Build a second exact historical context with three pending observations:
  -- it passes the 50% gate but must remain provisional.
  SELECT c.player_member_id,c.player_user_id,c.canonical_session_id,
         c.canonical_session_match_id,c.role_assignment_id,
         wb.weight_set_id,wb.role_assignment_id,rb.rubric_version_id,wb.role_key
    INTO v_player_member,v_player_user,v_session,v_match,v_role,v_set,v_role,v_rubric,v_status
  FROM public.evolution_evaluation_contexts c
  JOIN public.evolution_evaluation_role_weight_bindings wb
    ON wb.evaluation_context_id=c.id AND wb.team_id=c.team_id
  JOIN public.evolution_evaluation_rubric_bindings rb
    ON rb.evaluation_context_id=c.id AND rb.team_id=c.team_id
  WHERE c.id=v_context;

  INSERT INTO public.evolution_evaluation_contexts(
    team_id,player_member_id,player_user_id,canonical_session_id,
    canonical_session_match_id,role_assignment_id,created_by
  ) VALUES(v_team,v_player_member,v_player_user,v_session,v_match,v_role,auth.uid())
  RETURNING id INTO v_provisional_context;
  INSERT INTO public.evolution_evaluation_rubric_bindings(
    team_id,evaluation_context_id,rubric_version_id,bound_by
  ) VALUES(v_team,v_provisional_context,v_rubric,auth.uid());
  INSERT INTO public.evolution_evaluation_role_weight_bindings(
    team_id,evaluation_context_id,role_assignment_id,weight_set_id,role_key,bound_by
  ) VALUES(v_team,v_provisional_context,v_role,v_set,v_status,auth.uid());

  FOR v_dimension,v_definition IN
    SELECT dimension_key,dimension_definition_version
    FROM public.evolution_role_dimension_weights
    WHERE weight_set_id=v_set ORDER BY dimension_key LIMIT 3
  LOOP
    INSERT INTO public.evolution_evidence_items(
      team_id,evaluation_context_id,visibility,status,source_type,title,observation,created_by
    ) VALUES(
      v_team,v_provisional_context,'team','pending','manual_observation',
      'Phase 3.10 provisional fixture '||v_dimension,
      'Pending evidence must remain provisional.',
      auth.uid()
    ) RETURNING id INTO v_evidence;
    INSERT INTO public.evolution_evidence_dimension_links(
      team_id,evidence_item_id,dimension_key,definition_version,created_by
    ) VALUES(v_team,v_evidence,v_dimension,v_definition,auth.uid());
    INSERT INTO public.evolution_evaluation_dimension_assessment_events(
      team_id,evaluation_context_id,dimension_key,dimension_definition_version,
      revision_number,assessment_state,rating_value,evidence_item_id,actor_user_id
    ) VALUES(v_team,v_provisional_context,v_dimension,v_definition,1,'observed',7,v_evidence,auth.uid());
  END LOOP;

  v_provisional_snapshot := public.calculate_evolution_player_score_snapshot(v_provisional_context);
  SELECT score_status,score100,provisional_score100 INTO v_status,v_old_score,v_new_score
  FROM public.evolution_player_score_snapshots WHERE id=v_provisional_snapshot;
  IF v_status<>'provisional' OR v_old_score IS NOT NULL OR v_new_score IS NULL THEN
    RAISE EXCEPTION 'Pending evidence at the coverage threshold must persist only a provisional score';
  END IF;

  -- A third context with no assessment rows must persist Insufficient without a score.
  INSERT INTO public.evolution_evaluation_contexts(
    team_id,player_member_id,player_user_id,canonical_session_id,
    canonical_session_match_id,role_assignment_id,created_by
  ) VALUES(v_team,v_player_member,v_player_user,v_session,v_match,v_role,auth.uid())
  RETURNING id INTO v_insufficient_context;
  INSERT INTO public.evolution_evaluation_rubric_bindings(
    team_id,evaluation_context_id,rubric_version_id,bound_by
  ) VALUES(v_team,v_insufficient_context,v_rubric,auth.uid());
  INSERT INTO public.evolution_evaluation_role_weight_bindings(
    team_id,evaluation_context_id,role_assignment_id,weight_set_id,role_key,bound_by
  ) VALUES(v_team,v_insufficient_context,v_role,v_set,v_status,auth.uid());

  v_insufficient_snapshot := public.calculate_evolution_player_score_snapshot(v_insufficient_context);
  SELECT score_status,score100,provisional_score100 INTO v_status,v_old_score,v_new_score
  FROM public.evolution_player_score_snapshots WHERE id=v_insufficient_snapshot;
  IF v_status<>'insufficient' OR v_old_score IS NOT NULL OR v_new_score IS NOT NULL THEN
    RAISE EXCEPTION 'Insufficient inputs must never expose a final or provisional score';
  END IF;

  -- Snapshot rows are visible to staff but immutable and not directly insertable.
  BEGIN
    UPDATE public.evolution_player_score_snapshots SET score100=0 WHERE id=v_snapshot_one;
    RAISE EXCEPTION 'Score snapshot update unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    DELETE FROM public.evolution_player_score_snapshots WHERE id=v_snapshot_one;
    RAISE EXCEPTION 'Score snapshot delete unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '55000' THEN NULL;
  END;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.evolution_player_score_snapshots','INSERT')
    OR has_table_privilege('authenticated','public.evolution_player_score_snapshots','UPDATE')
    OR has_table_privilege('authenticated','public.evolution_player_score_snapshots','DELETE')
    OR has_table_privilege('anon','public.evolution_player_score_snapshots','SELECT')
  THEN RAISE EXCEPTION 'Score snapshot ACLs are too permissive'; END IF;
END $$;
SELECT 'Evolution Phase 3.10 score snapshot history PostgreSQL PASS' AS result;
SQL
