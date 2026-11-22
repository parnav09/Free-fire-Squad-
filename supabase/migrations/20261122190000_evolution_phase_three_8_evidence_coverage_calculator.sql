-- Evolution Phase 3.8 — reproducible evidence coverage snapshots.
-- Coverage is deliberately independent from performance scoring and never reads match outcomes.

CREATE TABLE IF NOT EXISTS public.evolution_evidence_coverage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  evaluation_context_id uuid NOT NULL,
  rubric_version_id uuid NOT NULL,
  weight_set_id uuid NOT NULL,
  calculation_version text NOT NULL CHECK (calculation_version = 'evidence-coverage-v1'),
  input_fingerprint text NOT NULL CHECK (input_fingerprint ~ '^[0-9a-f]{32}$'),
  input_snapshot jsonb NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
  applicable_dimension_count integer NOT NULL CHECK (applicable_dimension_count >= 0),
  observed_dimension_count integer NOT NULL CHECK (observed_dimension_count BETWEEN 0 AND applicable_dimension_count),
  not_observed_dimension_count integer NOT NULL CHECK (not_observed_dimension_count BETWEEN 0 AND applicable_dimension_count),
  incomplete_dimension_count integer NOT NULL CHECK (incomplete_dimension_count BETWEEN 0 AND applicable_dimension_count),
  rejected_evidence_dimension_count integer NOT NULL CHECK (rejected_evidence_dimension_count BETWEEN 0 AND applicable_dimension_count),
  missing_dimension_count integer NOT NULL CHECK (missing_dimension_count BETWEEN 0 AND applicable_dimension_count),
  verified_evidence_dimension_count integer NOT NULL CHECK (verified_evidence_dimension_count BETWEEN 0 AND observed_dimension_count),
  unverified_evidence_dimension_count integer NOT NULL CHECK (unverified_evidence_dimension_count BETWEEN 0 AND observed_dimension_count),
  coverage_basis_points integer CHECK (coverage_basis_points BETWEEN 0 AND 10000),
  coverage_percent numeric(5,2) CHECK (coverage_percent BETWEEN 0 AND 100),
  coverage_status text NOT NULL CHECK (coverage_status IN ('complete','partial','insufficient')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_coverage_context_team_fk
    FOREIGN KEY (evaluation_context_id, team_id)
    REFERENCES public.evolution_evaluation_contexts(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_coverage_rubric_team_fk
    FOREIGN KEY (rubric_version_id, team_id)
    REFERENCES public.evolution_rubric_versions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_coverage_weight_set_team_fk
    FOREIGN KEY (weight_set_id, team_id)
    REFERENCES public.evolution_role_weight_sets(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_coverage_counts_reconcile CHECK (
    observed_dimension_count + not_observed_dimension_count + incomplete_dimension_count
      + rejected_evidence_dimension_count + missing_dimension_count = applicable_dimension_count
  ),
  CONSTRAINT evolution_coverage_evidence_reconcile CHECK (
    verified_evidence_dimension_count + unverified_evidence_dimension_count = observed_dimension_count
  ),
  CONSTRAINT evolution_coverage_percentage_pair CHECK (
    (applicable_dimension_count = 0 AND coverage_basis_points IS NULL AND coverage_percent IS NULL
      AND coverage_status = 'insufficient')
    OR (applicable_dimension_count > 0 AND coverage_basis_points IS NOT NULL
      AND coverage_percent = coverage_basis_points::numeric / 100)
  ),
  CONSTRAINT evolution_coverage_status_pair CHECK (
    (coverage_status = 'insufficient' AND (applicable_dimension_count = 0 OR observed_dimension_count = 0))
    OR (coverage_status = 'complete' AND applicable_dimension_count > 0
      AND observed_dimension_count = applicable_dimension_count AND unverified_evidence_dimension_count = 0)
    OR (coverage_status = 'partial' AND applicable_dimension_count > 0 AND observed_dimension_count > 0
      AND (observed_dimension_count < applicable_dimension_count OR unverified_evidence_dimension_count > 0))
  ),
  CONSTRAINT evolution_coverage_input_idempotency UNIQUE
    (evaluation_context_id, calculation_version, input_fingerprint),
  CONSTRAINT evolution_coverage_id_team_unique UNIQUE (id, team_id)
);

CREATE INDEX IF NOT EXISTS evolution_evidence_coverage_context_history_idx
  ON public.evolution_evidence_coverage_snapshots(team_id, evaluation_context_id, created_at DESC);

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_evidence_coverage_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Evidence coverage snapshots are immutable; create a new calculation snapshot'
      USING ERRCODE = '55000';
  END IF;
  IF auth.uid() IS NULL OR NEW.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authenticated coverage calculator required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.guard_evolution_evidence_coverage_snapshot()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS evolution_evidence_coverage_snapshot_guard
  ON public.evolution_evidence_coverage_snapshots;
CREATE TRIGGER evolution_evidence_coverage_snapshot_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.evolution_evidence_coverage_snapshots
FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_evidence_coverage_snapshot();

ALTER TABLE public.evolution_evidence_coverage_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evolution_evidence_coverage_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.evolution_evidence_coverage_snapshots TO authenticated;

DROP POLICY IF EXISTS evolution_evidence_coverage_team_read ON public.evolution_evidence_coverage_snapshots;
CREATE POLICY evolution_evidence_coverage_team_read
ON public.evolution_evidence_coverage_snapshots FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.team_id = evolution_evidence_coverage_snapshots.team_id
    AND tm.user_id = auth.uid() AND tm.status = 'active'
    AND tm.membership_role IN ('owner','coach')
));

CREATE OR REPLACE FUNCTION public.calculate_evolution_evidence_coverage(p_evaluation_context_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_team uuid;
  v_rubric uuid;
  v_weight_set uuid;
  v_inputs jsonb;
  v_fingerprint text;
  v_applicable integer;
  v_observed integer;
  v_not_observed integer;
  v_incomplete integer;
  v_rejected integer;
  v_missing integer;
  v_verified integer;
  v_unverified integer;
  v_basis_points integer;
  v_percent numeric(5,2);
  v_status text;
  v_snapshot_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authenticated_user_required' USING ERRCODE = '42501';
  END IF;

  SELECT c.team_id, rb.rubric_version_id, wb.weight_set_id
    INTO v_team, v_rubric, v_weight_set
  FROM public.evolution_evaluation_contexts c
  JOIN public.evolution_evaluation_rubric_bindings rb
    ON rb.evaluation_context_id = c.id AND rb.team_id = c.team_id
  JOIN public.evolution_evaluation_role_weight_bindings wb
    ON wb.evaluation_context_id = c.id AND wb.team_id = c.team_id
  WHERE c.id = p_evaluation_context_id;

  IF v_team IS NULL THEN
    RAISE EXCEPTION 'exact_rubric_and_role_weight_bindings_required' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_team AND tm.user_id = v_actor
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN
    RAISE EXCEPTION 'active_team_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;

  -- SECURITY DEFINER bypasses evidence RLS; fail closed rather than exposing another
  -- author's private evidence through the reproducibility snapshot.
  IF EXISTS (
    SELECT 1
    FROM public.evolution_evaluation_current_dimension_assessments a
    JOIN public.evolution_evidence_items e
      ON e.id = a.evidence_item_id AND e.team_id = a.team_id
    WHERE a.evaluation_context_id = p_evaluation_context_id
      AND a.team_id = v_team
      AND e.visibility = 'private'
      AND e.created_by IS DISTINCT FROM v_actor
  ) THEN
    RAISE EXCEPTION 'private_evidence_not_available_to_coverage_calculator'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'dimension_key', w.dimension_key,
    'dimension_definition_version', w.dimension_definition_version,
    'assessment_revision', a.revision_number,
    'assessment_state', a.assessment_state,
    'evidence_item_id', a.evidence_item_id,
    'evidence_status', es.status
  ) ORDER BY w.dimension_key), '[]'::jsonb)
  INTO v_inputs
  FROM public.evolution_role_dimension_weights w
  LEFT JOIN public.evolution_evaluation_current_dimension_assessments a
    ON a.evaluation_context_id = p_evaluation_context_id
    AND a.team_id = v_team
    AND a.dimension_key = w.dimension_key
    AND a.dimension_definition_version = w.dimension_definition_version
  LEFT JOIN public.evolution_evidence_current_status es
    ON es.evidence_item_id = a.evidence_item_id AND es.team_id = a.team_id
  WHERE w.weight_set_id = v_weight_set AND w.team_id = v_team;

  IF jsonb_array_length(v_inputs) = 0 THEN
    RAISE EXCEPTION 'bound_role_weight_set_has_no_applicable_dimensions' USING ERRCODE = '23514';
  END IF;

  WITH dimensions AS (
    SELECT item->>'assessment_state' AS assessment_state,
      item->>'evidence_status' AS evidence_status
    FROM jsonb_array_elements(v_inputs) AS d(item)
  )
  SELECT count(*)::integer,
    count(*) FILTER (WHERE assessment_state = 'observed'
      AND evidence_status IN ('pending','verified','corrected'))::integer,
    count(*) FILTER (WHERE assessment_state = 'not_observed')::integer,
    count(*) FILTER (WHERE assessment_state = 'incomplete')::integer,
    count(*) FILTER (WHERE assessment_state = 'rejected_evidence'
      OR (assessment_state = 'observed' AND coalesce(evidence_status,'') NOT IN ('pending','verified','corrected')))::integer,
    count(*) FILTER (WHERE assessment_state IS NULL)::integer,
    count(*) FILTER (WHERE assessment_state = 'observed' AND evidence_status = 'verified')::integer,
    count(*) FILTER (WHERE assessment_state = 'observed' AND evidence_status IN ('pending','corrected'))::integer
  INTO v_applicable,v_observed,v_not_observed,v_incomplete,v_rejected,v_missing,v_verified,v_unverified
  FROM dimensions;

  v_fingerprint := md5(v_inputs::text);
  v_basis_points := round((v_observed::numeric * 10000) / v_applicable)::integer;
  v_percent := (v_basis_points::numeric / 100)::numeric(5,2);
  v_status := CASE
    WHEN v_applicable = 0 OR v_observed = 0 THEN 'insufficient'
    WHEN v_observed = v_applicable AND v_unverified = 0 THEN 'complete'
    ELSE 'partial'
  END;

  INSERT INTO public.evolution_evidence_coverage_snapshots(
    team_id,evaluation_context_id,rubric_version_id,weight_set_id,
    calculation_version,input_fingerprint,input_snapshot,
    applicable_dimension_count,observed_dimension_count,not_observed_dimension_count,
    incomplete_dimension_count,rejected_evidence_dimension_count,missing_dimension_count,
    verified_evidence_dimension_count,unverified_evidence_dimension_count,
    coverage_basis_points,coverage_percent,coverage_status,created_by
  ) VALUES (
    v_team,p_evaluation_context_id,v_rubric,v_weight_set,
    'evidence-coverage-v1',v_fingerprint,
    jsonb_build_object('calculation_version','evidence-coverage-v1',
      'denominator','all_dimensions_in_bound_historical_role_weight_set',
      'numerator','observed_dimensions_with_pending_verified_or_corrected_evidence',
      'rounding','nearest_basis_point_half_up',
      'dimensions',v_inputs),
    v_applicable,v_observed,v_not_observed,v_incomplete,v_rejected,v_missing,
    v_verified,v_unverified,v_basis_points,v_percent,v_status,v_actor
  )
  ON CONFLICT (evaluation_context_id,calculation_version,input_fingerprint)
  DO NOTHING
  RETURNING id INTO v_snapshot_id;

  IF v_snapshot_id IS NULL THEN
    SELECT id INTO v_snapshot_id
    FROM public.evolution_evidence_coverage_snapshots
    WHERE evaluation_context_id = p_evaluation_context_id
      AND calculation_version = 'evidence-coverage-v1'
      AND input_fingerprint = v_fingerprint;
  END IF;
  RETURN v_snapshot_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.calculate_evolution_evidence_coverage(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_evolution_evidence_coverage(uuid) TO authenticated;

COMMENT ON TABLE public.evolution_evidence_coverage_snapshots IS
  'Immutable, versioned evidence coverage calculations. Counts and input snapshot are independent from performance scoring.';
COMMENT ON FUNCTION public.calculate_evolution_evidence_coverage(uuid) IS
  'Calculates reproducible evidence coverage from the bound historical role dimensions and appends an idempotent immutable snapshot; never calculates a player score.';
