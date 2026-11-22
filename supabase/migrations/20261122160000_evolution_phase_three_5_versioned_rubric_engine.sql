-- Evolution Phase 3.5 — versioned rubric engine.
-- Additive only. Published rubric versions and their criteria are immutable.
-- This point defines rubric contracts; scoring, weights and evaluation UI are later points.

CREATE TABLE IF NOT EXISTS public.evolution_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  rubric_key text NOT NULL CHECK (rubric_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_rubrics_team_key_unique UNIQUE (team_id, rubric_key),
  CONSTRAINT evolution_rubrics_id_team_unique UNIQUE (id, team_id)
);

CREATE TABLE IF NOT EXISTS public.evolution_rubric_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id uuid NOT NULL,
  team_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number >= 1),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 2000),
  lifecycle_status text NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft', 'active', 'retired')),
  effective_from timestamptz,
  effective_to timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  published_at timestamptz,
  retired_at timestamptz,
  CONSTRAINT evolution_rubric_versions_rubric_team_fk
    FOREIGN KEY (rubric_id, team_id)
    REFERENCES public.evolution_rubrics(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_rubric_versions_rubric_version_unique
    UNIQUE (rubric_id, version_number),
  CONSTRAINT evolution_rubric_versions_id_team_unique UNIQUE (id, team_id),
  CONSTRAINT evolution_rubric_versions_effective_range
    CHECK (effective_to IS NULL OR (effective_from IS NOT NULL AND effective_to > effective_from)),
  CONSTRAINT evolution_rubric_versions_publication_pair
    CHECK (
      (lifecycle_status = 'draft' AND published_by IS NULL AND published_at IS NULL AND retired_at IS NULL)
      OR (lifecycle_status = 'active' AND published_by IS NOT NULL AND published_at IS NOT NULL AND retired_at IS NULL AND effective_from IS NOT NULL)
      OR (lifecycle_status = 'retired' AND published_by IS NOT NULL AND published_at IS NOT NULL AND retired_at IS NOT NULL AND effective_from IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS evolution_rubric_versions_one_active_uidx
  ON public.evolution_rubric_versions(rubric_id)
  WHERE lifecycle_status = 'active';
CREATE INDEX IF NOT EXISTS evolution_rubric_versions_team_status_idx
  ON public.evolution_rubric_versions(team_id, lifecycle_status, effective_from DESC);

CREATE TABLE IF NOT EXISTS public.evolution_rubric_dimension_criteria (
  rubric_version_id uuid NOT NULL,
  team_id uuid NOT NULL,
  dimension_key text NOT NULL,
  dimension_definition_version integer NOT NULL,
  criteria_guidance text NOT NULL
    CHECK (char_length(btrim(criteria_guidance)) BETWEEN 1 AND 2000),
  rating_anchors jsonb NOT NULL CHECK (jsonb_typeof(rating_anchors) = 'object'),
  role_guidance jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(role_guidance) = 'object'),
  sort_order smallint NOT NULL CHECK (sort_order BETWEEN 1 AND 32767),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_rubric_criteria_version_team_fk
    FOREIGN KEY (rubric_version_id, team_id)
    REFERENCES public.evolution_rubric_versions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_rubric_criteria_dimension_definition_fk
    FOREIGN KEY (dimension_key, dimension_definition_version)
    REFERENCES public.evolution_dimension_definition_versions(dimension_key, definition_version)
    ON DELETE RESTRICT,
  CONSTRAINT evolution_rubric_criteria_version_dimension_unique
    UNIQUE (rubric_version_id, dimension_key)
);

CREATE INDEX IF NOT EXISTS evolution_rubric_criteria_team_dimension_idx
  ON public.evolution_rubric_dimension_criteria(team_id, dimension_key, dimension_definition_version);

-- A binding records the exact published rubric version selected for one
-- evaluation context. It is immutable so later rubric edits cannot rewrite history.
CREATE TABLE IF NOT EXISTS public.evolution_evaluation_rubric_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  evaluation_context_id uuid NOT NULL,
  rubric_version_id uuid NOT NULL,
  bound_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  bound_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_evaluation_rubric_context_team_fk
    FOREIGN KEY (evaluation_context_id, team_id)
    REFERENCES public.evolution_evaluation_contexts(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evaluation_rubric_version_team_fk
    FOREIGN KEY (rubric_version_id, team_id)
    REFERENCES public.evolution_rubric_versions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evaluation_rubric_one_binding_per_context
    UNIQUE (evaluation_context_id),
  CONSTRAINT evolution_evaluation_rubric_binding_id_team_unique UNIQUE (id, team_id)
);

CREATE INDEX IF NOT EXISTS evolution_evaluation_rubric_bindings_team_time_idx
  ON public.evolution_evaluation_rubric_bindings(team_id, bound_at DESC);

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_rubric_identity_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NEW.created_by IS DISTINCT FROM auth.uid()
    OR NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = NEW.team_id AND tm.user_id = auth.uid()
        AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
    ) THEN
    RAISE EXCEPTION 'Only active team owners/coaches may create rubric identities'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_rubric_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  expected_version integer;
  rubric_team uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN
    RAISE EXCEPTION 'Only active team owners/coaches may manage rubric versions'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT r.team_id INTO rubric_team
    FROM public.evolution_rubrics r WHERE r.id = NEW.rubric_id;
    IF rubric_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'Rubric identity does not belong to the supplied team'
        USING ERRCODE = '23503';
    END IF;
    SELECT COALESCE(max(v.version_number), 0) + 1 INTO expected_version
    FROM public.evolution_rubric_versions v WHERE v.rubric_id = NEW.rubric_id;
    IF NEW.version_number <> expected_version THEN
      RAISE EXCEPTION 'Next rubric version must be %', expected_version
        USING ERRCODE = '23514';
    END IF;
    IF NEW.lifecycle_status <> 'draft' OR NEW.published_by IS NOT NULL
      OR NEW.published_at IS NOT NULL OR NEW.retired_at IS NOT NULL THEN
      RAISE EXCEPTION 'New rubric versions must begin as unpublished drafts'
        USING ERRCODE = '23514';
    END IF;
    NEW.created_by := auth.uid();
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Rubric version rows are retained; retire a published version instead'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.rubric_id IS DISTINCT FROM OLD.rubric_id
    OR NEW.team_id IS DISTINCT FROM OLD.team_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Rubric version identity and creation provenance are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD.lifecycle_status = 'retired' THEN
    RAISE EXCEPTION 'Retired rubric versions are immutable'
      USING ERRCODE = '55000';
  ELSIF OLD.lifecycle_status = 'draft' THEN
    IF NEW.lifecycle_status = 'draft' THEN
      IF NEW.published_by IS NOT NULL OR NEW.published_at IS NOT NULL OR NEW.retired_at IS NOT NULL THEN
        RAISE EXCEPTION 'Draft rubric versions cannot carry publication metadata'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    ELSIF NEW.lifecycle_status = 'active' THEN
      IF NEW.effective_from IS NULL OR NEW.effective_from > clock_timestamp()
        OR (NEW.effective_to IS NOT NULL AND NEW.effective_to <= NEW.effective_from) THEN
        RAISE EXCEPTION 'A rubric can be activated only with a valid effective start date'
          USING ERRCODE = '23514';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM public.evolution_dimension_registry d
        WHERE d.lifecycle_status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM public.evolution_rubric_dimension_criteria c
            WHERE c.rubric_version_id = NEW.id
              AND c.team_id = NEW.team_id
              AND c.dimension_key = d.dimension_key
          )
      ) THEN
        RAISE EXCEPTION 'A rubric must define criteria and all 0–10 anchors for every active canonical dimension'
          USING ERRCODE = '23514';
      END IF;
      NEW.published_by := auth.uid();
      NEW.published_at := clock_timestamp();
      NEW.retired_at := NULL;
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'A draft rubric can only remain draft or be published active'
        USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.lifecycle_status = 'active' THEN
    IF NEW.lifecycle_status <> 'retired' THEN
      RAISE EXCEPTION 'An active rubric version can only be retired'
        USING ERRCODE = '55000';
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.published_by IS DISTINCT FROM OLD.published_by
      OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      RAISE EXCEPTION 'Published rubric content and effective start are immutable'
        USING ERRCODE = '55000';
    END IF;
    NEW.retired_at := clock_timestamp();
    IF NEW.effective_to IS NULL THEN
      NEW.effective_to := NEW.retired_at;
    END IF;
    IF NEW.effective_to <= NEW.effective_from THEN
      RAISE EXCEPTION 'Rubric retirement must end after its effective start'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unsupported rubric lifecycle transition'
    USING ERRCODE = '23514';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_rubric_criteria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  rubric_status text;
  rubric_team uuid;
  allowed_roles text[];
  supplied_key text;
  supplied_value jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT v.lifecycle_status, v.team_id INTO rubric_status, rubric_team
    FROM public.evolution_rubric_versions v
    WHERE v.id = OLD.rubric_version_id;
  ELSE
    SELECT v.lifecycle_status, v.team_id INTO rubric_status, rubric_team
    FROM public.evolution_rubric_versions v
    WHERE v.id = NEW.rubric_version_id;
  END IF;

  IF rubric_status IS DISTINCT FROM 'draft' OR rubric_team IS DISTINCT FROM
    CASE WHEN TG_OP = 'DELETE' THEN OLD.team_id ELSE NEW.team_id END THEN
    RAISE EXCEPTION 'Rubric criteria can be changed only while their version is a draft'
      USING ERRCODE = '55000';
  END IF;

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = rubric_team AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN
    RAISE EXCEPTION 'Only active team owners/coaches may edit rubric criteria'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.rubric_version_id IS DISTINCT FROM OLD.rubric_version_id
    OR NEW.team_id IS DISTINCT FROM OLD.team_id
    OR NEW.dimension_key IS DISTINCT FROM OLD.dimension_key
    OR NEW.dimension_definition_version IS DISTINCT FROM OLD.dimension_definition_version
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Rubric criterion identity and creation provenance are immutable'
      USING ERRCODE = '55000';
  END IF;

  SELECT d.applicable_role_keys INTO allowed_roles
  FROM public.evolution_dimension_definition_versions d
  JOIN public.evolution_dimension_registry r
    ON r.dimension_key = d.dimension_key AND r.lifecycle_status = 'active'
  WHERE d.dimension_key = NEW.dimension_key
    AND d.definition_version = NEW.dimension_definition_version;
  IF allowed_roles IS NULL THEN
    RAISE EXCEPTION 'Rubric criteria must reference an active canonical dimension definition version'
      USING ERRCODE = '23503';
  END IF;

  IF jsonb_typeof(NEW.rating_anchors) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(NEW.rating_anchors)) <> 11 THEN
    RAISE EXCEPTION 'Every rubric dimension must define exactly eleven rating anchors, 0 through 10'
      USING ERRCODE = '23514';
  END IF;

  FOR supplied_key, supplied_value IN
    SELECT key, value FROM jsonb_each(NEW.rating_anchors)
  LOOP
    IF supplied_key NOT IN ('0','1','2','3','4','5','6','7','8','9','10')
      OR jsonb_typeof(supplied_value) <> 'string'
      OR char_length(btrim(supplied_value #>> '{}')) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'Each rating anchor must contain a non-empty text description for a rating from 0 through 10'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  IF jsonb_typeof(NEW.role_guidance) <> 'object' THEN
    RAISE EXCEPTION 'Role guidance must be a JSON object'
      USING ERRCODE = '23514';
  END IF;

  FOR supplied_key, supplied_value IN
    SELECT key, value FROM jsonb_each(NEW.role_guidance)
  LOOP
    IF NOT (supplied_key = ANY(allowed_roles))
      OR jsonb_typeof(supplied_value) <> 'string'
      OR char_length(btrim(supplied_value #>> '{}')) NOT BETWEEN 1 AND 1000 THEN
      RAISE EXCEPTION 'Role guidance must use applicable canonical role keys and non-empty text'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_evaluation_rubric_binding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  rubric_status text;
  rubric_start timestamptz;
  rubric_end timestamptz;
  context_created_at timestamptz;
  context_team uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Evaluation rubric bindings are immutable'
      USING ERRCODE = '55000';
  END IF;
  IF auth.uid() IS NULL OR NEW.bound_by IS DISTINCT FROM auth.uid()
    OR NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = NEW.team_id AND tm.user_id = auth.uid()
        AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
    ) THEN
    RAISE EXCEPTION 'Only active team owners/coaches may bind a rubric to an evaluation context'
      USING ERRCODE = '42501';
  END IF;

  SELECT c.team_id, c.created_at, v.lifecycle_status, v.effective_from, v.effective_to
    INTO context_team, context_created_at, rubric_status, rubric_start, rubric_end
  FROM public.evolution_evaluation_contexts c
  JOIN public.evolution_rubric_versions v
    ON v.id = NEW.rubric_version_id AND v.team_id = NEW.team_id
  WHERE c.id = NEW.evaluation_context_id AND c.team_id = NEW.team_id;

  IF context_team IS NULL THEN
    RAISE EXCEPTION 'Evaluation context and rubric must belong to the same team'
      USING ERRCODE = '23503';
  END IF;
  IF rubric_status <> 'active' THEN
    RAISE EXCEPTION 'Only an active published rubric version can be bound'
      USING ERRCODE = '23514';
  END IF;
  IF context_created_at < rubric_start
    OR (rubric_end IS NOT NULL AND context_created_at >= rubric_end) THEN
    RAISE EXCEPTION 'Rubric version was not effective when the evaluation context was created'
      USING ERRCODE = '23514';
  END IF;
  NEW.bound_by := auth.uid();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.guard_evolution_rubric_identity_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.guard_evolution_rubric_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.guard_evolution_rubric_criteria() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.guard_evolution_evaluation_rubric_binding() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS evolution_rubric_identity_insert_guard ON public.evolution_rubrics;
CREATE TRIGGER evolution_rubric_identity_insert_guard
  BEFORE INSERT ON public.evolution_rubrics
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_rubric_identity_insert();

DROP TRIGGER IF EXISTS evolution_rubric_version_lifecycle_guard ON public.evolution_rubric_versions;
CREATE TRIGGER evolution_rubric_version_lifecycle_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.evolution_rubric_versions
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_rubric_version();

DROP TRIGGER IF EXISTS evolution_rubric_criteria_draft_guard ON public.evolution_rubric_dimension_criteria;
CREATE TRIGGER evolution_rubric_criteria_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.evolution_rubric_dimension_criteria
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_rubric_criteria();

DROP TRIGGER IF EXISTS evolution_evaluation_rubric_binding_immutable ON public.evolution_evaluation_rubric_bindings;
CREATE TRIGGER evolution_evaluation_rubric_binding_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.evolution_evaluation_rubric_bindings
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_evaluation_rubric_binding();

ALTER TABLE public.evolution_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_rubric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_rubric_dimension_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_evaluation_rubric_bindings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.evolution_rubrics, public.evolution_rubric_versions,
  public.evolution_rubric_dimension_criteria, public.evolution_evaluation_rubric_bindings
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.evolution_rubrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evolution_rubric_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evolution_rubric_dimension_criteria TO authenticated;
GRANT SELECT, INSERT ON public.evolution_evaluation_rubric_bindings TO authenticated;

DROP POLICY IF EXISTS evolution_rubrics_team_read ON public.evolution_rubrics;
CREATE POLICY evolution_rubrics_team_read ON public.evolution_rubrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_rubrics.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND (
          tm.membership_role IN ('owner','coach')
          OR EXISTS (
            SELECT 1 FROM public.evolution_rubric_versions v
            WHERE v.rubric_id = evolution_rubrics.id AND v.lifecycle_status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS evolution_rubrics_owner_coach_insert ON public.evolution_rubrics;
CREATE POLICY evolution_rubrics_owner_coach_insert ON public.evolution_rubrics
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_rubrics.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.membership_role IN ('owner','coach')
    )
  );

DROP POLICY IF EXISTS evolution_rubric_versions_team_read ON public.evolution_rubric_versions;
CREATE POLICY evolution_rubric_versions_team_read ON public.evolution_rubric_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_rubric_versions.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND (
          tm.membership_role IN ('owner','coach')
          OR evolution_rubric_versions.lifecycle_status = 'active'
        )
    )
  );

DROP POLICY IF EXISTS evolution_rubric_versions_owner_coach_insert ON public.evolution_rubric_versions;
CREATE POLICY evolution_rubric_versions_owner_coach_insert ON public.evolution_rubric_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    lifecycle_status = 'draft'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_rubric_versions.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.membership_role IN ('owner','coach')
    )
  );

DROP POLICY IF EXISTS evolution_rubric_versions_owner_coach_update ON public.evolution_rubric_versions;
CREATE POLICY evolution_rubric_versions_owner_coach_update ON public.evolution_rubric_versions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_rubric_versions.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.membership_role IN ('owner','coach')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_rubric_versions.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.membership_role IN ('owner','coach')
    )
  );

DROP POLICY IF EXISTS evolution_rubric_criteria_team_read ON public.evolution_rubric_dimension_criteria;
CREATE POLICY evolution_rubric_criteria_team_read ON public.evolution_rubric_dimension_criteria
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.evolution_rubric_versions v
        ON v.team_id = tm.team_id AND v.id = rubric_version_id
      WHERE tm.team_id = evolution_rubric_dimension_criteria.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND (
          tm.membership_role IN ('owner','coach')
          OR v.lifecycle_status = 'active'
        )
    )
  );

DROP POLICY IF EXISTS evolution_rubric_criteria_owner_coach_insert ON public.evolution_rubric_dimension_criteria;
CREATE POLICY evolution_rubric_criteria_owner_coach_insert ON public.evolution_rubric_dimension_criteria
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.evolution_rubric_versions v
        ON v.team_id = tm.team_id AND v.id = rubric_version_id
      WHERE tm.team_id = evolution_rubric_dimension_criteria.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.membership_role IN ('owner','coach')
        AND v.lifecycle_status = 'draft'
    )
  );

DROP POLICY IF EXISTS evolution_rubric_criteria_owner_coach_update ON public.evolution_rubric_dimension_criteria;
CREATE POLICY evolution_rubric_criteria_owner_coach_update ON public.evolution_rubric_dimension_criteria
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.evolution_rubric_versions v
        ON v.team_id = tm.team_id AND v.id = rubric_version_id
      WHERE tm.team_id = evolution_rubric_dimension_criteria.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.membership_role IN ('owner','coach')
        AND v.lifecycle_status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.evolution_rubric_versions v
        ON v.team_id = tm.team_id AND v.id = rubric_version_id
      WHERE tm.team_id = evolution_rubric_dimension_criteria.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.membership_role IN ('owner','coach')
        AND v.lifecycle_status = 'draft'
    )
  );

DROP POLICY IF EXISTS evolution_rubric_criteria_owner_coach_delete ON public.evolution_rubric_dimension_criteria;
CREATE POLICY evolution_rubric_criteria_owner_coach_delete ON public.evolution_rubric_dimension_criteria
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.evolution_rubric_versions v
        ON v.team_id = tm.team_id AND v.id = rubric_version_id
      WHERE tm.team_id = evolution_rubric_dimension_criteria.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.membership_role IN ('owner','coach')
        AND v.lifecycle_status = 'draft'
    )
  );

DROP POLICY IF EXISTS evolution_evaluation_rubric_bindings_team_read ON public.evolution_evaluation_rubric_bindings;
CREATE POLICY evolution_evaluation_rubric_bindings_team_read ON public.evolution_evaluation_rubric_bindings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_evaluation_rubric_bindings.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

DROP POLICY IF EXISTS evolution_evaluation_rubric_bindings_owner_coach_insert ON public.evolution_evaluation_rubric_bindings;
CREATE POLICY evolution_evaluation_rubric_bindings_owner_coach_insert ON public.evolution_evaluation_rubric_bindings
  FOR INSERT TO authenticated
  WITH CHECK (
    bound_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_evaluation_rubric_bindings.team_id
        AND tm.user_id = auth.uid() AND tm.status = 'active'
        AND tm.membership_role IN ('owner','coach')
    )
  );

COMMENT ON TABLE public.evolution_rubrics IS
  'Stable team-scoped rubric identity; each substantive revision is a separately versioned record.';
COMMENT ON TABLE public.evolution_rubric_versions IS
  'Draft, active and retired rubric versions. Activation publishes an immutable version with an effective date range.';
COMMENT ON TABLE public.evolution_rubric_dimension_criteria IS
  'Dimension-specific criteria and explicit text anchors for every integer rating from 0 through 10; role guidance is optional and applicability-checked.';
COMMENT ON TABLE public.evolution_evaluation_rubric_bindings IS
  'Immutable binding from an evaluation context to the exact active rubric version effective when that context was created.';
