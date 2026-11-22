-- Evolution Phase 3.6 — role-based, versioned weight configuration.
-- Additive only. This point configures weights; it does not calculate or persist scores.

CREATE TABLE IF NOT EXISTS public.evolution_role_weight_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  rubric_version_id uuid NOT NULL,
  role_key text NOT NULL CHECK (role_key IN (
    'primary_rusher','secondary_rusher','third_rusher_flanker',
    'sniper_igl','substitute_flex','other'
  )),
  version_number integer NOT NULL CHECK (version_number >= 1),
  lifecycle_status text NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft','active','retired')),
  effective_from timestamptz,
  effective_to timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  published_at timestamptz,
  retired_at timestamptz,
  CONSTRAINT evolution_role_weight_sets_rubric_team_fk
    FOREIGN KEY (rubric_version_id, team_id)
    REFERENCES public.evolution_rubric_versions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_role_weight_sets_version_unique
    UNIQUE (rubric_version_id, role_key, version_number),
  CONSTRAINT evolution_role_weight_sets_id_team_unique UNIQUE (id, team_id),
  CONSTRAINT evolution_role_weight_sets_effective_range
    CHECK (effective_to IS NULL OR (effective_from IS NOT NULL AND effective_to > effective_from)),
  CONSTRAINT evolution_role_weight_sets_lifecycle_pair CHECK (
    (lifecycle_status = 'draft' AND effective_from IS NULL AND effective_to IS NULL
      AND published_by IS NULL AND published_at IS NULL AND retired_at IS NULL)
    OR (lifecycle_status = 'active' AND effective_from IS NOT NULL AND effective_from >= created_at AND effective_to IS NULL
      AND published_by IS NOT NULL AND published_at IS NOT NULL AND retired_at IS NULL)
    OR (lifecycle_status = 'retired' AND effective_from IS NOT NULL AND effective_from >= created_at AND effective_to IS NOT NULL
      AND published_by IS NOT NULL AND published_at IS NOT NULL AND retired_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS evolution_role_weight_sets_one_active_uidx
  ON public.evolution_role_weight_sets(rubric_version_id, role_key)
  WHERE lifecycle_status = 'active';

CREATE INDEX IF NOT EXISTS evolution_role_weight_sets_team_role_idx
  ON public.evolution_role_weight_sets(team_id, role_key, rubric_version_id, version_number DESC);

CREATE TABLE IF NOT EXISTS public.evolution_role_dimension_weights (
  weight_set_id uuid NOT NULL,
  team_id uuid NOT NULL,
  dimension_key text NOT NULL,
  dimension_definition_version integer NOT NULL,
  weight_basis_points integer NOT NULL CHECK (weight_basis_points BETWEEN 0 AND 10000),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_role_dimension_weights_set_team_fk
    FOREIGN KEY (weight_set_id, team_id)
    REFERENCES public.evolution_role_weight_sets(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_role_dimension_weights_definition_fk
    FOREIGN KEY (dimension_key, dimension_definition_version)
    REFERENCES public.evolution_dimension_definition_versions(dimension_key, definition_version)
    ON DELETE RESTRICT,
  CONSTRAINT evolution_role_dimension_weights_set_dimension_unique
    UNIQUE (weight_set_id, dimension_key)
);

CREATE INDEX IF NOT EXISTS evolution_role_dimension_weights_team_idx
  ON public.evolution_role_dimension_weights(team_id, weight_set_id);

CREATE TABLE IF NOT EXISTS public.evolution_evaluation_role_weight_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  evaluation_context_id uuid NOT NULL,
  role_assignment_id uuid NOT NULL,
  weight_set_id uuid NOT NULL,
  role_key text NOT NULL CHECK (role_key IN (
    'primary_rusher','secondary_rusher','third_rusher_flanker',
    'sniper_igl','substitute_flex','other'
  )),
  bound_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  bound_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_eval_role_weight_context_team_fk
    FOREIGN KEY (evaluation_context_id, team_id)
    REFERENCES public.evolution_evaluation_contexts(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_eval_role_weight_assignment_team_fk
    FOREIGN KEY (role_assignment_id, team_id)
    REFERENCES public.canonical_session_match_roles(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_eval_role_weight_set_team_fk
    FOREIGN KEY (weight_set_id, team_id)
    REFERENCES public.evolution_role_weight_sets(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_eval_role_weight_one_per_context UNIQUE (evaluation_context_id),
  CONSTRAINT evolution_eval_role_weight_id_team_unique UNIQUE (id, team_id)
);

CREATE OR REPLACE FUNCTION evolution_private.canonical_role_key_from_snapshot(p_role_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT CASE lower(btrim(p_role_key))
    WHEN 'primary rusher' THEN 'primary_rusher'
    WHEN 'primary_rusher' THEN 'primary_rusher'
    WHEN 'secondary rusher' THEN 'secondary_rusher'
    WHEN 'secondary_rusher' THEN 'secondary_rusher'
    WHEN 'third rusher flanker' THEN 'third_rusher_flanker'
    WHEN 'third_rusher_flanker' THEN 'third_rusher_flanker'
    WHEN 'sniper + igl' THEN 'sniper_igl'
    WHEN 'sniper igl' THEN 'sniper_igl'
    WHEN 'sniper_igl' THEN 'sniper_igl'
    WHEN 'substitute flex' THEN 'substitute_flex'
    WHEN 'substitute_flex' THEN 'substitute_flex'
    WHEN 'other' THEN 'other'
    ELSE NULL
  END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.canonical_role_key_from_snapshot(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_role_weight_set()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_rubric_status text;
  v_expected_version integer;
  v_weight_count integer;
  v_applicable_count integer;
  v_total integer;
BEGIN
  IF auth.uid() IS NULL OR NEW.created_by IS DISTINCT FROM auth.uid()
    AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'authenticated_creator_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN
    RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM 1 FROM public.evolution_rubric_versions rv
    WHERE rv.id = NEW.rubric_version_id AND rv.team_id = NEW.team_id
    FOR UPDATE;
    SELECT rv.lifecycle_status INTO v_rubric_status
    FROM public.evolution_rubric_versions rv
    WHERE rv.id = NEW.rubric_version_id AND rv.team_id = NEW.team_id;
    IF v_rubric_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'role_weight_set_requires_an_active_rubric_version' USING ERRCODE = '23514';
    END IF;
    SELECT coalesce(max(ws.version_number),0) + 1 INTO v_expected_version
    FROM public.evolution_role_weight_sets ws
    WHERE ws.rubric_version_id = NEW.rubric_version_id AND ws.role_key = NEW.role_key;
    IF NEW.version_number IS DISTINCT FROM v_expected_version
      OR NEW.lifecycle_status <> 'draft'
      OR NEW.effective_from IS NOT NULL OR NEW.effective_to IS NOT NULL
      OR NEW.published_by IS NOT NULL OR NEW.published_at IS NOT NULL OR NEW.retired_at IS NOT NULL THEN
      RAISE EXCEPTION 'role_weight_set_must_start_as_next_sequential_draft_version' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'role_weight_set_history_is_retained' USING ERRCODE = '55000';
  END IF;

  IF ROW(NEW.id,NEW.team_id,NEW.rubric_version_id,NEW.role_key,NEW.version_number,
         NEW.created_by,NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id,OLD.team_id,OLD.rubric_version_id,OLD.role_key,OLD.version_number,
         OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'role_weight_set_identity_is_immutable' USING ERRCODE = '55000';
  END IF;

  IF OLD.lifecycle_status = 'draft' AND NEW.lifecycle_status = 'draft' THEN
    IF ROW(NEW.effective_from,NEW.effective_to,NEW.published_by,NEW.published_at,NEW.retired_at)
       IS DISTINCT FROM
       ROW(OLD.effective_from,OLD.effective_to,OLD.published_by,OLD.published_at,OLD.retired_at) THEN
      RAISE EXCEPTION 'draft_weight_set_lifecycle_fields_are_system_managed' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.lifecycle_status = 'draft' AND NEW.lifecycle_status = 'active' THEN
    SELECT rv.lifecycle_status INTO v_rubric_status
    FROM public.evolution_rubric_versions rv
    WHERE rv.id = OLD.rubric_version_id AND rv.team_id = OLD.team_id;
    IF v_rubric_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'role_weight_set_requires_an_active_rubric_version' USING ERRCODE = '23514';
    END IF;
    IF NEW.effective_from IS NULL OR NEW.effective_from < OLD.created_at OR NEW.effective_to IS NOT NULL
      OR NEW.published_by IS DISTINCT FROM auth.uid()
      OR NEW.published_at IS NOT NULL OR NEW.retired_at IS NOT NULL THEN
      RAISE EXCEPTION 'role_weight_set_publication_metadata_invalid' USING ERRCODE = '23514';
    END IF;

    SELECT count(*), coalesce(sum(w.weight_basis_points),0)
      INTO v_weight_count,v_total
    FROM public.evolution_role_dimension_weights w
    WHERE w.weight_set_id = OLD.id AND w.team_id = OLD.team_id;

    SELECT count(*) INTO v_applicable_count
    FROM public.evolution_rubric_dimension_criteria rc
    JOIN public.evolution_dimension_definition_versions dd
      ON dd.dimension_key = rc.dimension_key
     AND dd.definition_version = rc.dimension_definition_version
    JOIN public.evolution_dimension_registry dr USING (dimension_key)
    WHERE rc.rubric_version_id = OLD.rubric_version_id
      AND dr.lifecycle_status = 'active'
      AND OLD.role_key = ANY(dd.applicable_role_keys);

    IF v_applicable_count = 0 OR v_weight_count <> v_applicable_count
      OR v_total <> 10000 THEN
      RAISE EXCEPTION 'role_weight_set_must_cover_every_applicable_dimension_and_total_10000_basis_points (found %, applicable %, total %)',
        v_weight_count,v_applicable_count,v_total USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.evolution_role_dimension_weights w
      JOIN public.evolution_dimension_definition_versions dd
        ON dd.dimension_key = w.dimension_key
       AND dd.definition_version = w.dimension_definition_version
      JOIN public.evolution_dimension_registry dr USING (dimension_key)
      WHERE w.weight_set_id = OLD.id AND w.team_id = OLD.team_id
        AND (dr.lifecycle_status <> 'active' OR NOT (OLD.role_key = ANY(dd.applicable_role_keys))
          OR NOT EXISTS (
            SELECT 1 FROM public.evolution_rubric_dimension_criteria rc
            WHERE rc.rubric_version_id = OLD.rubric_version_id
              AND rc.dimension_key = w.dimension_key
              AND rc.dimension_definition_version = w.dimension_definition_version
          ))
    ) THEN
      RAISE EXCEPTION 'role_weight_set_contains_non_applicable_or_unrubriced_dimension' USING ERRCODE = '23514';
    END IF;

    NEW.published_at := clock_timestamp();
    RETURN NEW;
  END IF;

  IF OLD.lifecycle_status = 'active' AND NEW.lifecycle_status = 'retired' THEN
    IF NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.effective_to IS NOT NULL
      OR NEW.published_by IS DISTINCT FROM OLD.published_by
      OR NEW.published_at IS DISTINCT FROM OLD.published_at
      OR NEW.retired_at IS NOT NULL THEN
      RAISE EXCEPTION 'role_weight_set_retirement_metadata_invalid' USING ERRCODE = '23514';
    END IF;
    NEW.effective_to := clock_timestamp();
    IF NEW.effective_to <= OLD.effective_from THEN
      RAISE EXCEPTION 'role_weight_set_retirement_must_follow_effective_start' USING ERRCODE = '23514';
    END IF;
    NEW.retired_at := NEW.effective_to;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid_role_weight_set_lifecycle_transition' USING ERRCODE = '55000';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_role_dimension_weight()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role_key text;
  v_rubric_version_id uuid;
  v_set_status text;
  v_applicable_roles text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.team_id ELSE NEW.team_id END
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.membership_role IN ('owner','coach')
  ) THEN
    RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;
  -- Serialize edits with publication so an activation cannot validate a partial weight set.
  PERFORM 1 FROM public.evolution_role_weight_sets ws
  WHERE ws.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.weight_set_id ELSE NEW.weight_set_id END
    AND ws.team_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.team_id ELSE NEW.team_id END
  FOR UPDATE;

  IF TG_OP = 'UPDATE' AND (
    NEW.weight_set_id IS DISTINCT FROM OLD.weight_set_id
    OR NEW.team_id IS DISTINCT FROM OLD.team_id
    OR NEW.dimension_key IS DISTINCT FROM OLD.dimension_key
    OR NEW.dimension_definition_version IS DISTINCT FROM OLD.dimension_definition_version
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'role_dimension_weight_identity_is_immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT lifecycle_status INTO v_set_status
    FROM public.evolution_role_weight_sets
    WHERE id = OLD.weight_set_id AND team_id = OLD.team_id;
    IF v_set_status <> 'draft' THEN
      RAISE EXCEPTION 'published_role_dimension_weights_are_immutable' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  SELECT ws.role_key,ws.rubric_version_id,ws.lifecycle_status,dd.applicable_role_keys
    INTO v_role_key,v_rubric_version_id,v_set_status,v_applicable_roles
  FROM public.evolution_role_weight_sets ws
  JOIN public.evolution_dimension_definition_versions dd
    ON dd.dimension_key = NEW.dimension_key
   AND dd.definition_version = NEW.dimension_definition_version
  JOIN public.evolution_dimension_registry dr
    ON dr.dimension_key = dd.dimension_key AND dr.lifecycle_status = 'active'
  JOIN public.evolution_rubric_dimension_criteria rc
    ON rc.rubric_version_id = ws.rubric_version_id
   AND rc.dimension_key = dd.dimension_key
   AND rc.dimension_definition_version = dd.definition_version
  WHERE ws.id = NEW.weight_set_id AND ws.team_id = NEW.team_id;

  IF v_set_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'only_draft_role_weight_sets_are_editable' USING ERRCODE = '55000';
  END IF;
  IF v_role_key IS NULL OR NOT (v_role_key = ANY(v_applicable_roles)) THEN
    RAISE EXCEPTION 'dimension_is_not_applicable_to_role_or_rubric' USING ERRCODE = '23514';
  END IF;
  NEW.created_by := coalesce(NEW.created_by,auth.uid());
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_evaluation_role_weight_binding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_context public.evolution_evaluation_contexts;
  v_role public.canonical_session_match_roles;
  v_set public.evolution_role_weight_sets;
  v_rubric_binding public.evolution_evaluation_rubric_bindings;
  v_resolved_role text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Evaluation role-weight bindings are immutable' USING ERRCODE = '55000';
  END IF;
  IF auth.uid() IS NULL OR NEW.bound_by IS DISTINCT FROM auth.uid()
    OR NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = NEW.team_id AND tm.user_id = auth.uid()
        AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
    ) THEN
    RAISE EXCEPTION 'Only active team owners/coaches may bind role weights' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_context
  FROM public.evolution_evaluation_contexts c
  WHERE c.id = NEW.evaluation_context_id AND c.team_id = NEW.team_id;
  IF NOT FOUND OR v_context.role_assignment_id IS NULL
    OR v_context.role_assignment_id IS DISTINCT FROM NEW.role_assignment_id THEN
    RAISE EXCEPTION 'Evaluation context must contain the exact immutable match role snapshot' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_role
  FROM public.canonical_session_match_roles r
  WHERE r.id = NEW.role_assignment_id AND r.team_id = NEW.team_id
    AND r.canonical_session_id = v_context.canonical_session_id
    AND r.canonical_session_match_id = v_context.canonical_session_match_id
    AND r.player_user_id = v_context.player_user_id;
  IF NOT FOUND OR v_role.role_assignment_status NOT IN ('assigned','retired') THEN
    RAISE EXCEPTION 'A known assigned role snapshot is required; current player role is never substituted' USING ERRCODE = '23514';
  END IF;
  v_resolved_role := evolution_private.canonical_role_key_from_snapshot(v_role.role_key_snapshot);
  IF v_resolved_role IS NULL OR v_resolved_role <> NEW.role_key THEN
    RAISE EXCEPTION 'Role-weight role must match the canonicalized historical role snapshot' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_rubric_binding
  FROM public.evolution_evaluation_rubric_bindings b
  WHERE b.evaluation_context_id = NEW.evaluation_context_id AND b.team_id = NEW.team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evaluation context must be bound to its exact rubric version first' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_set
  FROM public.evolution_role_weight_sets ws
  WHERE ws.id = NEW.weight_set_id AND ws.team_id = NEW.team_id
    AND ws.rubric_version_id = v_rubric_binding.rubric_version_id
    AND ws.role_key = v_resolved_role;
  IF NOT FOUND OR v_set.lifecycle_status <> 'active'
    OR v_context.created_at < v_set.effective_from
    OR (v_set.effective_to IS NOT NULL AND v_context.created_at >= v_set.effective_to) THEN
    RAISE EXCEPTION 'Active effective role weight set for the bound rubric and historical role is required' USING ERRCODE = '23514';
  END IF;

  NEW.role_key := v_resolved_role;
  NEW.bound_by := auth.uid();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.guard_evolution_role_weight_set() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.guard_evolution_role_dimension_weight() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.guard_evolution_evaluation_role_weight_binding() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS evolution_role_weight_set_guard ON public.evolution_role_weight_sets;
CREATE TRIGGER evolution_role_weight_set_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.evolution_role_weight_sets
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_role_weight_set();

DROP TRIGGER IF EXISTS evolution_role_dimension_weight_guard ON public.evolution_role_dimension_weights;
CREATE TRIGGER evolution_role_dimension_weight_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.evolution_role_dimension_weights
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_role_dimension_weight();

DROP TRIGGER IF EXISTS evolution_evaluation_role_weight_binding_guard ON public.evolution_evaluation_role_weight_bindings;
CREATE TRIGGER evolution_evaluation_role_weight_binding_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.evolution_evaluation_role_weight_bindings
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_evaluation_role_weight_binding();

ALTER TABLE public.evolution_role_weight_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_role_dimension_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_evaluation_role_weight_bindings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.evolution_role_weight_sets,
  public.evolution_role_dimension_weights,
  public.evolution_evaluation_role_weight_bindings
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evolution_role_weight_sets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evolution_role_dimension_weights TO authenticated;
GRANT SELECT, INSERT ON public.evolution_evaluation_role_weight_bindings TO authenticated;

DROP POLICY IF EXISTS evolution_role_weight_sets_team_read ON public.evolution_role_weight_sets;
CREATE POLICY evolution_role_weight_sets_team_read ON public.evolution_role_weight_sets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = evolution_role_weight_sets.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND (tm.membership_role IN ('owner','coach')
        OR evolution_role_weight_sets.lifecycle_status IN ('active','retired'))
  ));

DROP POLICY IF EXISTS evolution_role_weight_sets_owner_coach_insert ON public.evolution_role_weight_sets;
CREATE POLICY evolution_role_weight_sets_owner_coach_insert ON public.evolution_role_weight_sets
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND lifecycle_status = 'draft' AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = evolution_role_weight_sets.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS evolution_role_weight_sets_owner_coach_update ON public.evolution_role_weight_sets;
CREATE POLICY evolution_role_weight_sets_owner_coach_update ON public.evolution_role_weight_sets
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = evolution_role_weight_sets.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = evolution_role_weight_sets.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS evolution_role_dimension_weights_team_read ON public.evolution_role_dimension_weights;
CREATE POLICY evolution_role_dimension_weights_team_read ON public.evolution_role_dimension_weights
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.evolution_role_weight_sets ws
      ON ws.id = weight_set_id AND ws.team_id = tm.team_id
    WHERE tm.team_id = evolution_role_dimension_weights.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND (tm.membership_role IN ('owner','coach') OR ws.lifecycle_status IN ('active','retired'))
  ));

DROP POLICY IF EXISTS evolution_role_dimension_weights_owner_coach_insert ON public.evolution_role_dimension_weights;
CREATE POLICY evolution_role_dimension_weights_owner_coach_insert ON public.evolution_role_dimension_weights
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.evolution_role_weight_sets ws
      ON ws.id = weight_set_id AND ws.team_id = tm.team_id
    WHERE tm.team_id = evolution_role_dimension_weights.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
      AND ws.lifecycle_status = 'draft'
  ));

DROP POLICY IF EXISTS evolution_role_dimension_weights_owner_coach_update ON public.evolution_role_dimension_weights;
CREATE POLICY evolution_role_dimension_weights_owner_coach_update ON public.evolution_role_dimension_weights
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.evolution_role_weight_sets ws
      ON ws.id = weight_set_id AND ws.team_id = tm.team_id
    WHERE tm.team_id = evolution_role_dimension_weights.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
      AND ws.lifecycle_status = 'draft'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.evolution_role_weight_sets ws
      ON ws.id = weight_set_id AND ws.team_id = tm.team_id
    WHERE tm.team_id = evolution_role_dimension_weights.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
      AND ws.lifecycle_status = 'draft'
  ));

DROP POLICY IF EXISTS evolution_role_dimension_weights_owner_coach_delete ON public.evolution_role_dimension_weights;
CREATE POLICY evolution_role_dimension_weights_owner_coach_delete ON public.evolution_role_dimension_weights
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.evolution_role_weight_sets ws
      ON ws.id = weight_set_id AND ws.team_id = tm.team_id
    WHERE tm.team_id = evolution_role_dimension_weights.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
      AND ws.lifecycle_status = 'draft'
  ));

DROP POLICY IF EXISTS evolution_evaluation_role_weight_bindings_team_read ON public.evolution_evaluation_role_weight_bindings;
CREATE POLICY evolution_evaluation_role_weight_bindings_team_read ON public.evolution_evaluation_role_weight_bindings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = evolution_evaluation_role_weight_bindings.team_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
  ));

DROP POLICY IF EXISTS evolution_evaluation_role_weight_bindings_owner_coach_insert ON public.evolution_evaluation_role_weight_bindings;
CREATE POLICY evolution_evaluation_role_weight_bindings_owner_coach_insert ON public.evolution_evaluation_role_weight_bindings
  FOR INSERT TO authenticated
  WITH CHECK (bound_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = evolution_evaluation_role_weight_bindings.team_id
      AND tm.user_id = auth.uid() AND tm.status = 'active'
      AND tm.membership_role IN ('owner','coach')
  ));

COMMENT ON TABLE public.evolution_role_weight_sets IS
  'Sequential immutable weight-set versions scoped to one published rubric version and one canonical role.';
COMMENT ON TABLE public.evolution_role_dimension_weights IS
  'Integer basis-point weights for applicable rubric dimensions; active sets must cover every applicable dimension and total exactly 10000.';
COMMENT ON TABLE public.evolution_evaluation_role_weight_bindings IS
  'Immutable evaluation binding to the exact historical match role snapshot and effective role-weight set; current player role is never consulted.';
