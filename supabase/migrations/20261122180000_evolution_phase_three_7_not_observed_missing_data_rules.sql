-- Evolution Phase 3.7 — Not Observed & Missing Data Rules.
-- Additive only: legacy evaluation values are deliberately not backfilled or rewritten.
-- This point records dimension assessment states; it does not calculate or persist scores.

CREATE TABLE IF NOT EXISTS public.evolution_evaluation_dimension_assessment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  evaluation_context_id uuid NOT NULL,
  dimension_key text NOT NULL,
  dimension_definition_version integer NOT NULL CHECK (dimension_definition_version >= 1),
  revision_number integer NOT NULL CHECK (revision_number >= 1),
  assessment_state text NOT NULL CHECK (assessment_state IN
    ('observed','not_observed','not_applicable','incomplete','rejected_evidence')),
  rating_value smallint,
  evidence_item_id uuid,
  reason text,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_eval_dimension_assessment_context_fk
    FOREIGN KEY (evaluation_context_id, team_id)
    REFERENCES public.evolution_evaluation_contexts(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_eval_dimension_assessment_definition_fk
    FOREIGN KEY (dimension_key, dimension_definition_version)
    REFERENCES public.evolution_dimension_definition_versions(dimension_key, definition_version)
    ON DELETE RESTRICT,
  CONSTRAINT evolution_eval_dimension_assessment_evidence_fk
    FOREIGN KEY (evidence_item_id, team_id)
    REFERENCES public.evolution_evidence_items(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_eval_dimension_assessment_revision_unique
    UNIQUE (evaluation_context_id, dimension_key, revision_number),
  CONSTRAINT evolution_eval_dimension_assessment_value_shape CHECK (
    (assessment_state = 'observed' AND rating_value BETWEEN 0 AND 10 AND evidence_item_id IS NOT NULL)
    OR (assessment_state = 'not_observed' AND rating_value IS NULL AND evidence_item_id IS NULL
      AND char_length(btrim(coalesce(reason,''))) BETWEEN 3 AND 1000)
    OR (assessment_state = 'not_applicable' AND rating_value IS NULL AND evidence_item_id IS NULL
      AND char_length(btrim(coalesce(reason,''))) BETWEEN 3 AND 1000)
    OR (assessment_state = 'incomplete' AND rating_value IS NULL AND evidence_item_id IS NULL
      AND char_length(btrim(coalesce(reason,''))) BETWEEN 3 AND 1000)
    OR (assessment_state = 'rejected_evidence' AND rating_value IS NULL AND evidence_item_id IS NOT NULL
      AND char_length(btrim(coalesce(reason,''))) BETWEEN 3 AND 1000)
  )
);

CREATE INDEX IF NOT EXISTS evolution_eval_dimension_assessment_history_idx
  ON public.evolution_evaluation_dimension_assessment_events
    (team_id, evaluation_context_id, dimension_key, revision_number DESC);
CREATE INDEX IF NOT EXISTS evolution_eval_dimension_assessment_evidence_idx
  ON public.evolution_evaluation_dimension_assessment_events
    (team_id, evidence_item_id) WHERE evidence_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_evaluation_dimension_assessment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_rubric_id uuid;
  v_weight_set_id uuid;
  v_applicable boolean;
  v_evidence_status text;
  v_expected_revision integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Dimension assessment history is append-only; append a new revision' USING ERRCODE = '55000';
  END IF;
  IF auth.uid() IS NULL OR NEW.actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authenticated assessment actor required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.evaluation_context_id::text || ':' || NEW.dimension_key, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.evolution_evaluation_contexts c
    WHERE c.id = NEW.evaluation_context_id AND c.team_id = NEW.team_id
  ) THEN RAISE EXCEPTION 'Evaluation context not found in this team' USING ERRCODE = '23503'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'Active team owner or coach required' USING ERRCODE = '42501'; END IF;

  SELECT rb.rubric_version_id, wb.weight_set_id INTO v_rubric_id, v_weight_set_id
  FROM public.evolution_evaluation_rubric_bindings rb
  JOIN public.evolution_evaluation_role_weight_bindings wb
    ON wb.evaluation_context_id = rb.evaluation_context_id AND wb.team_id = rb.team_id
  WHERE rb.evaluation_context_id = NEW.evaluation_context_id AND rb.team_id = NEW.team_id;
  IF v_rubric_id IS NULL OR v_weight_set_id IS NULL THEN
    RAISE EXCEPTION 'Exact rubric and historical role-weight bindings are required first' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.evolution_rubric_dimension_criteria rc
    WHERE rc.rubric_version_id = v_rubric_id
      AND rc.dimension_key = NEW.dimension_key
      AND rc.dimension_definition_version = NEW.dimension_definition_version
  ) THEN RAISE EXCEPTION 'Assessment must pin a dimension definition in the bound rubric version' USING ERRCODE = '23514'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.evolution_role_dimension_weights w
    WHERE w.weight_set_id = v_weight_set_id AND w.team_id = NEW.team_id
      AND w.dimension_key = NEW.dimension_key
      AND w.dimension_definition_version = NEW.dimension_definition_version
  ) INTO v_applicable;

  IF NEW.assessment_state = 'not_applicable' THEN
    IF v_applicable THEN RAISE EXCEPTION 'A role-applicable dimension cannot be marked not_applicable' USING ERRCODE = '23514'; END IF;
  ELSIF NOT v_applicable THEN
    RAISE EXCEPTION 'Only a role-applicable dimension may receive this assessment state' USING ERRCODE = '23514';
  END IF;

  IF NEW.assessment_state IN ('observed','rejected_evidence') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.evolution_evidence_items e
      JOIN public.evolution_evidence_dimension_links dl
        ON dl.evidence_item_id = e.id AND dl.team_id = e.team_id
      WHERE e.id = NEW.evidence_item_id AND e.team_id = NEW.team_id
        AND e.evaluation_context_id = NEW.evaluation_context_id
        AND dl.dimension_key = NEW.dimension_key
        AND dl.definition_version = NEW.dimension_definition_version
    ) THEN RAISE EXCEPTION 'Evidence must belong to this evaluation context and exact dimension definition' USING ERRCODE = '23514'; END IF;

    SELECT s.status INTO v_evidence_status
    FROM public.evolution_evidence_current_status s
    WHERE s.evidence_item_id = NEW.evidence_item_id AND s.team_id = NEW.team_id;

    IF NEW.assessment_state = 'observed' AND v_evidence_status NOT IN ('pending','verified','corrected') THEN
      RAISE EXCEPTION 'Observed ratings require non-rejected, non-archived evidence' USING ERRCODE = '23514';
    END IF;
    IF NEW.assessment_state = 'rejected_evidence' AND v_evidence_status IS DISTINCT FROM 'rejected' THEN
      RAISE EXCEPTION 'rejected_evidence state requires currently rejected evidence' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.evidence_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'This assessment state cannot reference evidence' USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(max(a.revision_number),0) + 1 INTO v_expected_revision
  FROM public.evolution_evaluation_dimension_assessment_events a
  WHERE a.evaluation_context_id = NEW.evaluation_context_id AND a.dimension_key = NEW.dimension_key;
  IF NEW.revision_number IS DISTINCT FROM v_expected_revision THEN
    RAISE EXCEPTION 'Assessment revision must be sequential (expected %, received %)',
      v_expected_revision, NEW.revision_number USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.guard_evolution_evaluation_dimension_assessment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS evolution_eval_dimension_assessment_guard ON public.evolution_evaluation_dimension_assessment_events;
CREATE TRIGGER evolution_eval_dimension_assessment_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.evolution_evaluation_dimension_assessment_events
FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_evaluation_dimension_assessment();

ALTER TABLE public.evolution_evaluation_dimension_assessment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evolution_evaluation_dimension_assessment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.evolution_evaluation_dimension_assessment_events TO authenticated;

DROP POLICY IF EXISTS evolution_eval_dimension_assessment_team_read ON public.evolution_evaluation_dimension_assessment_events;
CREATE POLICY evolution_eval_dimension_assessment_team_read
ON public.evolution_evaluation_dimension_assessment_events FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = evolution_evaluation_dimension_assessment_events.team_id
      AND tm.user_id = auth.uid() AND tm.status = 'active')
  AND (evidence_item_id IS NULL OR EXISTS (
    SELECT 1 FROM public.evolution_evidence_items e
    WHERE e.id = evidence_item_id AND e.team_id = evolution_evaluation_dimension_assessment_events.team_id
      AND (e.created_by = auth.uid() OR e.visibility = 'team'
        OR (e.visibility = 'coaches' AND EXISTS (
          SELECT 1 FROM public.team_members staff
          WHERE staff.team_id = e.team_id AND staff.user_id = auth.uid()
            AND staff.status = 'active' AND staff.membership_role IN ('owner','coach')
        )))
  ))
);
DROP POLICY IF EXISTS evolution_eval_dimension_assessment_staff_insert ON public.evolution_evaluation_dimension_assessment_events;
CREATE POLICY evolution_eval_dimension_assessment_staff_insert
ON public.evolution_evaluation_dimension_assessment_events FOR INSERT TO authenticated
WITH CHECK (actor_user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.team_id = evolution_evaluation_dimension_assessment_events.team_id
    AND tm.user_id = auth.uid() AND tm.status = 'active'
    AND tm.membership_role IN ('owner','coach')
));

CREATE OR REPLACE VIEW public.evolution_evaluation_current_dimension_assessments
WITH (security_invoker = true) AS
SELECT DISTINCT ON (a.evaluation_context_id, a.dimension_key)
  a.team_id, a.evaluation_context_id, a.dimension_key, a.dimension_definition_version,
  a.revision_number, a.assessment_state, a.rating_value, a.evidence_item_id,
  a.reason, a.actor_user_id, a.created_at
FROM public.evolution_evaluation_dimension_assessment_events a
ORDER BY a.evaluation_context_id, a.dimension_key, a.revision_number DESC, a.created_at DESC, a.id DESC;
GRANT SELECT ON public.evolution_evaluation_current_dimension_assessments TO authenticated;

CREATE OR REPLACE VIEW public.evolution_evaluation_assessment_readiness
WITH (security_invoker = true) AS
SELECT wb.team_id, wb.evaluation_context_id, wb.weight_set_id,
  count(w.dimension_key)::integer AS applicable_dimension_count,
  count(*) FILTER (WHERE a.assessment_state = 'observed')::integer AS observed_dimension_count,
  count(*) FILTER (WHERE a.assessment_state = 'not_observed')::integer AS not_observed_dimension_count,
  count(*) FILTER (WHERE a.assessment_state = 'incomplete')::integer AS incomplete_dimension_count,
  count(*) FILTER (WHERE a.assessment_state = 'rejected_evidence')::integer AS rejected_evidence_dimension_count,
  count(*) FILTER (WHERE a.assessment_state IS NULL)::integer AS missing_dimension_count,
  count(*) FILTER (WHERE a.assessment_state = 'observed' AND coalesce(es.status,'') <> 'verified')::integer
    AS unverified_observed_dimension_count,
  (SELECT count(*)::integer FROM public.evolution_evaluation_current_dimension_assessments na
   WHERE na.evaluation_context_id = wb.evaluation_context_id AND na.team_id = wb.team_id
     AND na.assessment_state = 'not_applicable') AS not_applicable_dimension_count,
  CASE
    WHEN count(a.id) = 0 THEN 'draft'
    WHEN count(*) FILTER (WHERE a.assessment_state = 'observed') = 0 THEN 'insufficient'
    WHEN count(*) FILTER (WHERE a.assessment_state IS NULL OR a.assessment_state IN ('incomplete','rejected_evidence')) > 0
      OR count(*) FILTER (WHERE a.assessment_state = 'observed' AND coalesce(es.status,'') <> 'verified') > 0
      THEN 'provisional'
    ELSE 'final'
  END AS assessment_status
FROM public.evolution_evaluation_role_weight_bindings wb
JOIN public.evolution_role_dimension_weights w
  ON w.weight_set_id = wb.weight_set_id AND w.team_id = wb.team_id
LEFT JOIN public.evolution_evaluation_current_dimension_assessments a
  ON a.evaluation_context_id = wb.evaluation_context_id AND a.team_id = wb.team_id
  AND a.dimension_key = w.dimension_key AND a.dimension_definition_version = w.dimension_definition_version
LEFT JOIN public.evolution_evidence_current_status es
  ON es.evidence_item_id = a.evidence_item_id AND es.team_id = a.team_id
GROUP BY wb.team_id, wb.evaluation_context_id, wb.weight_set_id;
GRANT SELECT ON public.evolution_evaluation_assessment_readiness TO authenticated;

COMMENT ON TABLE public.evolution_evaluation_dimension_assessment_events IS
  'Append-only dimension assessment history: zero is observed; Not Observed, Not Applicable, incomplete and rejected evidence are separate non-numeric states.';
COMMENT ON VIEW public.evolution_evaluation_current_dimension_assessments IS
  'Latest explicit state per context/dimension; absent rows remain missing and are never defaulted to zero.';
COMMENT ON VIEW public.evolution_evaluation_assessment_readiness IS
  'Assessment completeness only, not a score or score-eligibility promise. Not Observed remains separate from coverage.';
