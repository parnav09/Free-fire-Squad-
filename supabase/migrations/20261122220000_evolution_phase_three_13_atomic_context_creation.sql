-- Evolution Phase Three.13 — Atomic canonical evaluation context creation.
-- The context and its exact rubric/role-weight bindings are one transaction:
-- a failed binding must never leave an unusable orphan evaluation context.

CREATE OR REPLACE FUNCTION public.create_evolution_evaluation_context(
  p_team_id uuid,
  p_player_member_id uuid,
  p_player_user_id uuid,
  p_canonical_session_id uuid,
  p_canonical_session_match_id uuid,
  p_role_assignment_id uuid
)
RETURNS public.evolution_evaluation_contexts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_role_snapshot text;
  v_role_key text;
  v_rubric_version_id uuid;
  v_weight_set_id uuid;
  v_context public.evolution_evaluation_contexts%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authenticated_user_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = p_team_id AND tm.user_id = v_actor
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN
    RAISE EXCEPTION 'active_team_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = p_player_member_id AND tm.team_id = p_team_id
      AND tm.user_id = p_player_user_id AND tm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'evaluation_player_must_be_an_active_team_member' USING ERRCODE = '23503';
  END IF;

  SELECT r.role_key_snapshot
    INTO v_role_snapshot
  FROM public.canonical_session_match_roles r
  JOIN public.canonical_session_matches m
    ON m.id = r.canonical_session_match_id
   AND m.team_id = r.team_id
   AND m.canonical_session_id = r.canonical_session_id
  JOIN public.canonical_sessions s
    ON s.id = r.canonical_session_id
   AND s.team_id = r.team_id
  WHERE r.id = p_role_assignment_id
    AND r.team_id = p_team_id
    AND r.canonical_session_id = p_canonical_session_id
    AND r.canonical_session_match_id = p_canonical_session_match_id
    AND r.player_user_id = p_player_user_id
    AND r.role_assignment_status = 'assigned'
    AND s.archived_at IS NULL
    AND s.session_type IN ('scrim','tournament');

  IF v_role_snapshot IS NULL THEN
    RAISE EXCEPTION 'assigned_historical_match_role_required' USING ERRCODE = '23514';
  END IF;

  v_role_key := evolution_private.canonical_role_key_from_snapshot(v_role_snapshot);
  IF v_role_key IS NULL THEN
    RAISE EXCEPTION 'historical_role_snapshot_is_not_mapped_to_a_canonical_role' USING ERRCODE = '23514';
  END IF;

  SELECT rv.id, ws.id
    INTO v_rubric_version_id, v_weight_set_id
  FROM public.evolution_rubric_versions rv
  JOIN public.evolution_role_weight_sets ws
    ON ws.team_id = rv.team_id
   AND ws.rubric_version_id = rv.id
   AND ws.role_key = v_role_key
   AND ws.lifecycle_status = 'active'
   AND ws.effective_from <= v_now
   AND (ws.effective_to IS NULL OR ws.effective_to > v_now)
  WHERE rv.team_id = p_team_id
    AND rv.lifecycle_status = 'active'
    AND rv.effective_from <= v_now
    AND (rv.effective_to IS NULL OR rv.effective_to > v_now)
  ORDER BY rv.effective_from DESC, rv.version_number DESC,
    ws.effective_from DESC, ws.version_number DESC, ws.created_at DESC, rv.id, ws.id
  LIMIT 1;

  IF v_rubric_version_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.evolution_rubric_versions rv
      WHERE rv.team_id = p_team_id
        AND rv.lifecycle_status = 'active'
        AND rv.effective_from <= v_now
        AND (rv.effective_to IS NULL OR rv.effective_to > v_now)
    ) THEN
      RAISE EXCEPTION 'no_active_effective_role_weight_set_for_historical_role' USING ERRCODE = '23514';
    END IF;
    RAISE EXCEPTION 'no_active_effective_rubric_configured_for_team' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.evolution_evaluation_contexts (
    team_id, player_member_id, player_user_id,
    canonical_session_id, canonical_session_match_id,
    role_assignment_id, created_by
  ) VALUES (
    p_team_id, p_player_member_id, p_player_user_id,
    p_canonical_session_id, p_canonical_session_match_id,
    p_role_assignment_id, v_actor
  )
  RETURNING * INTO v_context;

  INSERT INTO public.evolution_evaluation_rubric_bindings (
    team_id, evaluation_context_id, rubric_version_id, bound_by
  ) VALUES (
    p_team_id, v_context.id, v_rubric_version_id, v_actor
  );

  INSERT INTO public.evolution_evaluation_role_weight_bindings (
    team_id, evaluation_context_id, role_assignment_id,
    weight_set_id, role_key, bound_by
  ) VALUES (
    p_team_id, v_context.id, p_role_assignment_id,
    v_weight_set_id, v_role_key, v_actor
  );

  RETURN v_context;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_evolution_evaluation_context(uuid,uuid,uuid,uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_evolution_evaluation_context(uuid,uuid,uuid,uuid,uuid,uuid)
  TO authenticated;

COMMENT ON FUNCTION public.create_evolution_evaluation_context(uuid,uuid,uuid,uuid,uuid,uuid) IS
  'Atomically creates a canonical match evaluation context and pins the exact effective rubric version and historical role-weight set. Any failed validation or binding rolls back the entire operation.';
