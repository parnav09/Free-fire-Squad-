-- Evolution Phase 3.11 — atomic scoring serialization and database integrity.
-- Additive only. All writes that can change a score input serialize on the
-- evaluation-context advisory lock used by the Phase 3.10 scoring RPC.

CREATE OR REPLACE FUNCTION evolution_private.lock_evaluation_context_for_scoring(
  p_evaluation_context_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_evaluation_context_id IS NULL THEN
    RAISE EXCEPTION 'evaluation_context_required_for_scoring_lock'
      USING ERRCODE = '23502';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_evaluation_context_id::text, 31010)
  );
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.lock_evaluation_context_for_scoring(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.lock_evidence_context_for_scoring_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_context_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'evolution_evidence_items' THEN
    v_context_id := NEW.evaluation_context_id;
  ELSE
    SELECT e.evaluation_context_id
      INTO v_context_id
    FROM public.evolution_evidence_items e
    WHERE e.id = NEW.evidence_item_id
      AND e.team_id = NEW.team_id
    FOR SHARE;
  END IF;

  IF v_context_id IS NULL THEN
    RAISE EXCEPTION 'evidence_context_required_for_scoring_lock'
      USING ERRCODE = '23503';
  END IF;

  PERFORM evolution_private.lock_evaluation_context_for_scoring(v_context_id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.lock_assessment_context_for_scoring_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM evolution_private.lock_evaluation_context_for_scoring(NEW.evaluation_context_id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.lock_evidence_context_for_scoring_write()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.lock_assessment_context_for_scoring_write()
  FROM PUBLIC, anon, authenticated;

-- Evidence identity creation, evidence content versions and status events all
-- affect the exact raw input fingerprint or eligibility of a score.
DROP TRIGGER IF EXISTS evolution_evidence_items_scoring_lock
  ON public.evolution_evidence_items;
CREATE TRIGGER evolution_evidence_items_scoring_lock
BEFORE INSERT ON public.evolution_evidence_items
FOR EACH ROW EXECUTE FUNCTION evolution_private.lock_evidence_context_for_scoring_write();

DROP TRIGGER IF EXISTS evolution_evidence_versions_scoring_lock
  ON public.evolution_evidence_versions;
CREATE TRIGGER evolution_evidence_versions_scoring_lock
BEFORE INSERT ON public.evolution_evidence_versions
FOR EACH ROW EXECUTE FUNCTION evolution_private.lock_evidence_context_for_scoring_write();

DROP TRIGGER IF EXISTS evolution_evidence_verification_scoring_lock
  ON public.evolution_evidence_verification_events;
CREATE TRIGGER evolution_evidence_verification_scoring_lock
BEFORE INSERT ON public.evolution_evidence_verification_events
FOR EACH ROW EXECUTE FUNCTION evolution_private.lock_evidence_context_for_scoring_write();

-- Assessment events are append-only, so serializing their inserts is sufficient
-- to make the scoring RPC see either the complete old or complete new revision.
DROP TRIGGER IF EXISTS evolution_eval_dimension_assessment_scoring_lock
  ON public.evolution_evaluation_dimension_assessment_events;
CREATE TRIGGER evolution_eval_dimension_assessment_scoring_lock
BEFORE INSERT ON public.evolution_evaluation_dimension_assessment_events
FOR EACH ROW EXECUTE FUNCTION evolution_private.lock_assessment_context_for_scoring_write();

-- No two recalculations may fork from the same prior snapshot, even if a future
-- writer bypasses the current RPC implementation.
CREATE UNIQUE INDEX IF NOT EXISTS evolution_score_snapshot_single_child_uidx
  ON public.evolution_player_score_snapshots(previous_snapshot_id)
  WHERE previous_snapshot_id IS NOT NULL;

-- Replace the calculator so its lock is obtained through the same shared
-- helper used by every score-input mutation trigger. Keep the entire
-- calculation + append inside the caller's PostgreSQL transaction.
CREATE OR REPLACE FUNCTION public.calculate_evolution_player_score_snapshot(
  p_evaluation_context_id uuid,
  p_recalculation_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_team uuid;
  v_player_member uuid;
  v_player_user uuid;
  v_context_created_at timestamptz;
  v_role_assignment uuid;
  v_snapshot_role_key text;
  v_rubric uuid;
  v_weight_set uuid;
  v_bound_role_key text;
  v_rubric_status text;
  v_rubric_from timestamptz;
  v_rubric_to timestamptz;
  v_weight_status text;
  v_weight_from timestamptz;
  v_weight_to timestamptz;
  v_applicable integer;
  v_weight_count integer;
  v_total_weight integer;
  v_observed integer := 0;
  v_not_observed integer := 0;
  v_missing integer := 0;
  v_incomplete integer := 0;
  v_rejected integer := 0;
  v_verified integer := 0;
  v_unverified integer := 0;
  v_observed_weight integer := 0;
  v_weighted_rating numeric(30,0) := 0;
  v_exact_numerator numeric(30,0);
  v_exact_denominator numeric(30,0);
  v_coverage integer;
  v_score_basis integer;
  v_provisional_basis integer;
  v_score_status text;
  v_reasons jsonb := '[]'::jsonb;
  v_inputs jsonb;
  v_fingerprint text;
  v_previous uuid;
  v_snapshot uuid;
  v_row record;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authenticated_user_required' USING ERRCODE = '42501';
  END IF;

  PERFORM evolution_private.lock_evaluation_context_for_scoring(p_evaluation_context_id);

  SELECT c.team_id,c.player_member_id,c.player_user_id,c.created_at,c.role_assignment_id,
         r.role_key_snapshot
    INTO v_team,v_player_member,v_player_user,v_context_created_at,v_role_assignment,v_snapshot_role_key
  FROM public.evolution_evaluation_contexts c
  JOIN public.canonical_session_match_roles r
    ON r.id=c.role_assignment_id AND r.team_id=c.team_id
  WHERE c.id=p_evaluation_context_id
  FOR SHARE OF c,r;
  IF v_team IS NULL OR v_role_assignment IS NULL THEN
    RAISE EXCEPTION 'evaluation_context_with_exact_role_snapshot_required' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id=v_team AND tm.user_id=v_actor
      AND tm.status='active' AND tm.membership_role IN ('owner','coach')
  ) THEN
    RAISE EXCEPTION 'active_team_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;

  -- Hold the membership row stable until this transaction completes. A
  -- concurrent role revocation cannot race the authorization decision.
  PERFORM 1 FROM public.team_members tm
  WHERE tm.team_id=v_team AND tm.user_id=v_actor
    AND tm.status='active' AND tm.membership_role IN ('owner','coach')
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'active_team_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;

  SELECT rb.rubric_version_id INTO v_rubric
  FROM public.evolution_evaluation_rubric_bindings rb
  WHERE rb.evaluation_context_id=p_evaluation_context_id AND rb.team_id=v_team;
  SELECT wb.weight_set_id,wb.role_key INTO v_weight_set,v_bound_role_key
  FROM public.evolution_evaluation_role_weight_bindings wb
  WHERE wb.evaluation_context_id=p_evaluation_context_id AND wb.team_id=v_team
    AND wb.role_assignment_id=v_role_assignment;
  IF v_rubric IS NULL OR v_weight_set IS NULL THEN
    RAISE EXCEPTION 'exact_rubric_and_historical_role_weight_bindings_required' USING ERRCODE = '23514';
  END IF;

  IF v_bound_role_key IS DISTINCT FROM evolution_private.canonical_role_key_from_snapshot(v_snapshot_role_key) THEN
    RAISE EXCEPTION 'bound_role_key_does_not_match_historical_role_snapshot' USING ERRCODE = '23514';
  END IF;

  SELECT rv.lifecycle_status,rv.effective_from,rv.effective_to
    INTO v_rubric_status,v_rubric_from,v_rubric_to
  FROM public.evolution_rubric_versions rv
  WHERE rv.id=v_rubric AND rv.team_id=v_team
  FOR SHARE;
  SELECT ws.lifecycle_status,ws.effective_from,ws.effective_to
    INTO v_weight_status,v_weight_from,v_weight_to
  FROM public.evolution_role_weight_sets ws
  WHERE ws.id=v_weight_set AND ws.team_id=v_team
    AND ws.rubric_version_id=v_rubric AND ws.role_key=v_bound_role_key
  FOR SHARE;

  IF v_rubric_status NOT IN ('active','retired') OR v_weight_status NOT IN ('active','retired')
    OR v_rubric_from IS NULL OR v_weight_from IS NULL
    OR v_context_created_at < v_rubric_from OR v_context_created_at < v_weight_from
    OR (v_rubric_to IS NOT NULL AND v_context_created_at >= v_rubric_to)
    OR (v_weight_to IS NOT NULL AND v_context_created_at >= v_weight_to) THEN
    RAISE EXCEPTION 'historical_rubric_or_weight_set_was_not_effective_at_context_time'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer INTO v_applicable
  FROM public.evolution_role_dimension_weights w
  JOIN public.evolution_rubric_dimension_criteria rc
    ON rc.rubric_version_id=v_rubric AND rc.team_id=v_team
    AND rc.dimension_key=w.dimension_key
    AND rc.dimension_definition_version=w.dimension_definition_version
  WHERE w.weight_set_id=v_weight_set AND w.team_id=v_team;
  SELECT count(*)::integer,coalesce(sum(weight_basis_points),0)::integer
    INTO v_weight_count,v_total_weight
  FROM public.evolution_role_dimension_weights w
  WHERE w.weight_set_id=v_weight_set AND w.team_id=v_team;
  IF v_applicable=0 OR v_weight_count<>v_applicable OR v_total_weight<>10000 THEN
    RAISE EXCEPTION 'historical_role_weight_set_must_cover_every_rubric_dimension_and_total_10000'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.evolution_evaluation_current_dimension_assessments a
    JOIN public.evolution_role_dimension_weights w
      ON w.weight_set_id=v_weight_set AND w.team_id=v_team
      AND w.dimension_key=a.dimension_key
    WHERE a.evaluation_context_id=p_evaluation_context_id
      AND a.team_id=v_team
      AND a.dimension_definition_version<>w.dimension_definition_version
  ) THEN
    RAISE EXCEPTION 'assessment_dimension_definition_version_mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.evolution_evaluation_current_dimension_assessments a
    JOIN public.evolution_role_dimension_weights w
      ON w.weight_set_id=v_weight_set AND w.team_id=v_team
      AND w.dimension_key=a.dimension_key
    JOIN public.evolution_evidence_items e
      ON e.id=a.evidence_item_id AND e.team_id=a.team_id
    WHERE a.evaluation_context_id=p_evaluation_context_id
      AND a.team_id=v_team AND e.visibility='private'
      AND e.created_by IS DISTINCT FROM v_actor
  ) THEN
    RAISE EXCEPTION 'private_evidence_not_available_to_score_calculator'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'calculation_version','deterministic-scoring-v1',
    'scoring_policy_version','deterministic-scoring-policy-v1',
    'context',jsonb_build_object(
      'id',c.id,'team_id',c.team_id,'player_member_id',c.player_member_id,
      'player_user_id',c.player_user_id,'created_at',c.created_at,
      'role_assignment_id',c.role_assignment_id,
      'role_key_snapshot',r.role_key_snapshot
    ),
    'rubric',jsonb_build_object(
      'id',rv.id,'version_number',rv.version_number,
      'lifecycle_status',rv.lifecycle_status,'effective_from',rv.effective_from,
      'effective_to',rv.effective_to,
      'criteria',coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'dimension_key',rc.dimension_key,
          'dimension_definition_version',rc.dimension_definition_version,
          'minimum_rating',rc.minimum_rating,'maximum_rating',rc.maximum_rating,
          'rating_anchors',rc.rating_anchors,
          'applicable_role_keys',rc.applicable_role_keys
        ) ORDER BY rc.dimension_key)
        FROM public.evolution_rubric_dimension_criteria rc
        WHERE rc.rubric_version_id=rv.id AND rc.team_id=c.team_id
      ),'[]'::jsonb)
    ),
    'weight_set',jsonb_build_object(
      'id',ws.id,'version_number',ws.version_number,
      'role_key',ws.role_key,'lifecycle_status',ws.lifecycle_status,
      'effective_from',ws.effective_from,'effective_to',ws.effective_to
    ),
    'weights',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'dimension_key',w.dimension_key,
        'dimension_definition_version',w.dimension_definition_version,
        'weight_basis_points',w.weight_basis_points
      ) ORDER BY w.dimension_key)
      FROM public.evolution_role_dimension_weights w
      WHERE w.weight_set_id=ws.id AND w.team_id=c.team_id
    ),'[]'::jsonb),
    'assessments',(
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'dimension_key',w.dimension_key,
        'dimension_definition_version',w.dimension_definition_version,
        'revision_number',a.revision_number,
        'assessment_state',a.assessment_state,
        'rating_value',a.rating_value,'reason',a.reason,
        'evidence_item_id',a.evidence_item_id,
        'evidence_status',es.status,
        'evidence_version_id',coalesce(es.evidence_version_id,latest_ev.id),
        'evidence_status_changed_at',es.status_changed_at,
        'evidence_content',CASE WHEN ev.id IS NULL THEN NULL ELSE jsonb_build_object(
          'version_number',ev.version_number,'source_type',ev.source_type,
          'title',ev.title,'observation',ev.observation,
          'source_locator',ev.source_locator,'occurred_at',ev.occurred_at,
          'source_metadata',ev.source_metadata
        ) END
      ) ORDER BY w.dimension_key),'[]'::jsonb)
      FROM public.evolution_role_dimension_weights w
      LEFT JOIN public.evolution_evaluation_current_dimension_assessments a
        ON a.evaluation_context_id=p_evaluation_context_id AND a.team_id=v_team
        AND a.dimension_key=w.dimension_key
      LEFT JOIN public.evolution_evidence_items e
        ON e.id=a.evidence_item_id AND e.team_id=a.team_id
      LEFT JOIN public.evolution_evidence_current_status es
        ON es.evidence_item_id=a.evidence_item_id AND es.team_id=a.team_id
      LEFT JOIN LATERAL (
        SELECT ver.id,ver.version_number,ver.source_type,ver.title,ver.observation,
          ver.source_locator,ver.occurred_at,ver.source_metadata
        FROM public.evolution_evidence_versions ver
        WHERE ver.evidence_item_id=a.evidence_item_id AND ver.team_id=a.team_id
        ORDER BY ver.version_number DESC LIMIT 1
      ) latest_ev ON true
      LEFT JOIN public.evolution_evidence_versions ev
        ON ev.id=coalesce(es.evidence_version_id,latest_ev.id)
        AND ev.evidence_item_id=a.evidence_item_id AND ev.team_id=a.team_id
      WHERE w.weight_set_id=ws.id AND w.team_id=v_team
    )
  )
  INTO v_inputs
  FROM public.evolution_evaluation_contexts c
  JOIN public.canonical_session_match_roles r ON r.id=c.role_assignment_id AND r.team_id=c.team_id
  JOIN public.evolution_rubric_versions rv ON rv.id=v_rubric AND rv.team_id=c.team_id
  JOIN public.evolution_role_weight_sets ws ON ws.id=v_weight_set AND ws.team_id=c.team_id
  WHERE c.id=p_evaluation_context_id;

  v_fingerprint := md5(v_inputs::text);

  FOR v_row IN
    SELECT w.dimension_key,w.dimension_definition_version,w.weight_basis_points,
      a.revision_number,a.assessment_state,a.rating_value,a.reason,
      a.evidence_item_id,es.status AS evidence_status,
      e.evaluation_context_id AS evidence_context_id,
      EXISTS (
        SELECT 1 FROM public.evolution_evidence_dimension_links el
        WHERE el.evidence_item_id=e.id AND el.team_id=e.team_id
          AND el.dimension_key=w.dimension_key
          AND el.definition_version=w.dimension_definition_version
      ) AS exact_dimension_link
    FROM public.evolution_role_dimension_weights w
    LEFT JOIN public.evolution_evaluation_current_dimension_assessments a
      ON a.evaluation_context_id=p_evaluation_context_id AND a.team_id=v_team
      AND a.dimension_key=w.dimension_key
    LEFT JOIN public.evolution_evidence_items e
      ON e.id=a.evidence_item_id AND e.team_id=a.team_id
    LEFT JOIN public.evolution_evidence_current_status es
      ON es.evidence_item_id=e.id AND es.team_id=e.team_id
    WHERE w.weight_set_id=v_weight_set AND w.team_id=v_team
    ORDER BY w.dimension_key
  LOOP
    IF v_row.assessment_state IS NULL THEN
      v_missing := v_missing + 1;
    ELSIF v_row.assessment_state='not_observed' THEN
      v_not_observed := v_not_observed + 1;
    ELSIF v_row.assessment_state='incomplete' THEN
      v_incomplete := v_incomplete + 1;
    ELSIF v_row.assessment_state='not_applicable' THEN
      RAISE EXCEPTION 'not_applicable_dimension_cannot_exist_in_bound_role_weight_set'
        USING ERRCODE = '23514';
    ELSIF v_row.assessment_state='rejected_evidence' THEN
      IF v_row.evidence_context_id IS DISTINCT FROM p_evaluation_context_id
        OR NOT coalesce(v_row.exact_dimension_link,false)
        OR coalesce(v_row.evidence_status,'')<>'rejected' THEN
        RAISE EXCEPTION 'rejected_evidence_assessment_must_reference_exact_rejected_evidence'
          USING ERRCODE = '23514';
      END IF;
      v_rejected := v_rejected + 1;
    ELSIF v_row.assessment_state='observed' THEN
      IF v_row.rating_value IS NULL OR v_row.rating_value NOT BETWEEN 0 AND 10 THEN
        RAISE EXCEPTION 'observed_rating_must_be_an_integer_from_0_through_10'
          USING ERRCODE = '23514';
      END IF;
      IF v_row.evidence_context_id IS DISTINCT FROM p_evaluation_context_id
        OR NOT coalesce(v_row.exact_dimension_link,false)
        OR coalesce(v_row.evidence_status,'') NOT IN ('pending','verified','corrected') THEN
        v_rejected := v_rejected + 1;
      ELSE
        v_observed := v_observed + 1;
        v_observed_weight := v_observed_weight + v_row.weight_basis_points;
        v_weighted_rating := v_weighted_rating
          + (v_row.rating_value::numeric * v_row.weight_basis_points::numeric);
        IF v_row.evidence_status='verified' THEN
          v_verified := v_verified + 1;
        ELSE
          v_unverified := v_unverified + 1;
        END IF;
      END IF;
    ELSE
      RAISE EXCEPTION 'unknown_assessment_state_cannot_be_scored' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  v_coverage := round((v_observed::numeric * 10000) / v_applicable)::integer;
  IF v_observed=0 OR v_observed_weight=0 THEN
    v_reasons := v_reasons || jsonb_build_array('no_valid_observed_weight');
  END IF;
  IF v_coverage<5000 THEN
    v_reasons := v_reasons || jsonb_build_array('coverage_below_minimum');
  END IF;
  IF v_missing>0 THEN v_reasons := v_reasons || jsonb_build_array('missing_dimensions'); END IF;
  IF v_incomplete>0 THEN v_reasons := v_reasons || jsonb_build_array('incomplete_dimensions'); END IF;
  IF v_rejected>0 THEN v_reasons := v_reasons || jsonb_build_array('rejected_or_ineligible_evidence'); END IF;
  IF v_unverified>0 THEN v_reasons := v_reasons || jsonb_build_array('unverified_evidence'); END IF;

  IF v_observed=0 OR v_observed_weight=0 OR v_coverage<5000 THEN
    v_score_status := 'insufficient';
  ELSE
    v_exact_numerator := v_weighted_rating * 1000;
    v_exact_denominator := v_observed_weight;
    v_score_basis := round(v_exact_numerator / v_exact_denominator)::integer;
    IF v_missing>0 OR v_incomplete>0 OR v_rejected>0 OR v_unverified>0 THEN
      v_score_status := 'provisional';
      v_provisional_basis := v_score_basis;
    ELSE
      v_score_status := 'final';
    END IF;
  END IF;

  SELECT id INTO v_snapshot
  FROM public.evolution_player_score_snapshots
  WHERE evaluation_context_id=p_evaluation_context_id
    AND calculation_version='deterministic-scoring-v1'
    AND input_fingerprint=v_fingerprint;
  IF v_snapshot IS NOT NULL THEN
    RETURN v_snapshot;
  END IF;

  SELECT id INTO v_previous
  FROM public.evolution_player_score_snapshots
  WHERE evaluation_context_id=p_evaluation_context_id
  ORDER BY created_at DESC,id DESC LIMIT 1;
  IF v_previous IS NOT NULL AND char_length(btrim(coalesce(p_recalculation_reason,''))) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'recalculation_reason_required_for_changed_inputs'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.evolution_player_score_snapshots(
    team_id,evaluation_context_id,player_member_id,player_user_id,
    role_assignment_id,role_key,rubric_version_id,weight_set_id,previous_snapshot_id,
    calculation_version,scoring_policy_version,input_fingerprint,input_snapshot,
    score_status,score_basis_points,score100,
    provisional_score_basis_points,provisional_score100,
    exact_score_numerator,exact_score_denominator,
    coverage_basis_points,coverage_percent,
    applicable_dimension_count,observed_dimension_count,not_observed_dimension_count,
    missing_dimension_count,incomplete_dimension_count,rejected_evidence_dimension_count,
    verified_evidence_dimension_count,unverified_evidence_dimension_count,
    observed_weight_basis_points,reasons,recalculation_reason,created_by
  ) VALUES (
    v_team,p_evaluation_context_id,v_player_member,v_player_user,
    v_role_assignment,v_bound_role_key,v_rubric,v_weight_set,v_previous,
    'deterministic-scoring-v1','deterministic-scoring-policy-v1',v_fingerprint,v_inputs,
    v_score_status,
    CASE WHEN v_score_status='final' THEN v_score_basis END,
    CASE WHEN v_score_status='final' THEN v_score_basis::numeric/100 END,
    CASE WHEN v_score_status='provisional' THEN v_provisional_basis END,
    CASE WHEN v_score_status='provisional' THEN v_provisional_basis::numeric/100 END,
    CASE WHEN v_score_status<>'insufficient' THEN v_exact_numerator END,
    CASE WHEN v_score_status<>'insufficient' THEN v_exact_denominator END,
    v_coverage,v_coverage::numeric/100,
    v_applicable,v_observed,v_not_observed,v_missing,v_incomplete,v_rejected,
    v_verified,v_unverified,v_observed_weight,v_reasons,p_recalculation_reason,v_actor
  )
  RETURNING id INTO v_snapshot;

  RETURN v_snapshot;
END;
$function$;

REVOKE ALL ON FUNCTION public.calculate_evolution_player_score_snapshot(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_evolution_player_score_snapshot(uuid,text)
  TO authenticated;

COMMENT ON FUNCTION public.calculate_evolution_player_score_snapshot(uuid,text) IS
  'Atomic serialized score calculation: input mutations and score snapshots share one transaction-scoped context lock. Recalculation history is append-only and cannot fork.';
