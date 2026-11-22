-- Evolution Phase 3.3 — Evidence data model.
-- Additive only. No legacy evaluation rows are converted or modified.
-- Evidence is attached to an explicit evaluation context; match-level contexts
-- must use the canonical match and the exact role snapshot for that player.

CREATE UNIQUE INDEX IF NOT EXISTS team_members_id_team_user_evolution_uidx
  ON public.team_members (id, team_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS canonical_session_matches_evidence_context_uidx
  ON public.canonical_session_matches (id, team_id, canonical_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS canonical_session_match_roles_evidence_context_uidx
  ON public.canonical_session_match_roles
    (id, team_id, canonical_session_id, canonical_session_match_id, player_user_id);

CREATE TABLE IF NOT EXISTS public.evolution_evaluation_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  player_member_id uuid NOT NULL,
  player_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  canonical_session_id uuid,
  canonical_session_match_id uuid,
  role_assignment_id uuid,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_evaluation_context_player_team_fk
    FOREIGN KEY (player_member_id, team_id, player_user_id)
    REFERENCES public.team_members(id, team_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evaluation_context_session_team_fk
    FOREIGN KEY (canonical_session_id, team_id)
    REFERENCES public.canonical_sessions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evaluation_context_match_team_fk
    FOREIGN KEY (canonical_session_match_id, team_id, canonical_session_id)
    REFERENCES public.canonical_session_matches(id, team_id, canonical_session_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evaluation_context_role_snapshot_fk
    FOREIGN KEY (
      role_assignment_id, team_id, canonical_session_id,
      canonical_session_match_id, player_user_id
    )
    REFERENCES public.canonical_session_match_roles(
      id, team_id, canonical_session_id, canonical_session_match_id, player_user_id
    ) ON DELETE RESTRICT,
  CONSTRAINT evolution_evaluation_context_match_role_pair CHECK (
    (canonical_session_match_id IS NULL AND role_assignment_id IS NULL)
    OR (canonical_session_match_id IS NOT NULL AND canonical_session_id IS NOT NULL
        AND role_assignment_id IS NOT NULL)
  ),
  CONSTRAINT evolution_evaluation_context_id_team_unique UNIQUE (id, team_id)
);

CREATE INDEX IF NOT EXISTS evolution_evaluation_contexts_player_time_idx
  ON public.evolution_evaluation_contexts(team_id, player_member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS evolution_evaluation_contexts_session_idx
  ON public.evolution_evaluation_contexts(team_id, canonical_session_id)
  WHERE canonical_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS evolution_evaluation_contexts_match_idx
  ON public.evolution_evaluation_contexts(team_id, canonical_session_match_id)
  WHERE canonical_session_match_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.evolution_evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  evaluation_context_id uuid NOT NULL,
  visibility text NOT NULL DEFAULT 'coaches'
    CHECK (visibility IN ('team', 'coaches', 'private')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_evidence_context_team_fk
    FOREIGN KEY (evaluation_context_id, team_id)
    REFERENCES public.evolution_evaluation_contexts(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evidence_item_id_team_unique UNIQUE (id, team_id)
);

CREATE INDEX IF NOT EXISTS evolution_evidence_items_context_time_idx
  ON public.evolution_evidence_items(team_id, evaluation_context_id, created_at DESC);
CREATE INDEX IF NOT EXISTS evolution_evidence_items_team_time_idx
  ON public.evolution_evidence_items(team_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.evolution_evidence_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  evidence_item_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number >= 1),
  source_type text NOT NULL CHECK (
    source_type IN ('manual_observation', 'vod_reference', 'round_note', 'match_reference')
  ),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  observation text NOT NULL CHECK (char_length(btrim(observation)) BETWEEN 1 AND 4000),
  source_locator text CHECK (
    source_locator IS NULL OR
    (char_length(btrim(source_locator)) BETWEEN 1 AND 2048
      AND source_locator ~* '^https?://')
  ),
  occurred_at timestamptz,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_metadata) = 'object'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_evidence_version_item_team_fk
    FOREIGN KEY (evidence_item_id, team_id)
    REFERENCES public.evolution_evidence_items(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evidence_version_unique UNIQUE (evidence_item_id, version_number),
  CONSTRAINT evolution_evidence_version_id_item_team_unique UNIQUE (id, evidence_item_id, team_id),
  CONSTRAINT evolution_evidence_external_locator_required CHECK (
    source_type NOT IN ('vod_reference', 'match_reference') OR source_locator IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS evolution_evidence_versions_timeline_idx
  ON public.evolution_evidence_versions(evidence_item_id, version_number DESC);
CREATE INDEX IF NOT EXISTS evolution_evidence_versions_source_idx
  ON public.evolution_evidence_versions(team_id, source_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.evolution_evidence_dimension_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  evidence_item_id uuid NOT NULL,
  dimension_key text NOT NULL,
  definition_version integer NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_evidence_dimension_item_team_fk
    FOREIGN KEY (evidence_item_id, team_id)
    REFERENCES public.evolution_evidence_items(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evidence_dimension_definition_fk
    FOREIGN KEY (dimension_key, definition_version)
    REFERENCES public.evolution_dimension_definition_versions(dimension_key, definition_version)
    ON DELETE RESTRICT,
  CONSTRAINT evolution_evidence_dimension_unique
    UNIQUE (evidence_item_id, dimension_key, definition_version)
);

CREATE INDEX IF NOT EXISTS evolution_evidence_dimension_lookup_idx
  ON public.evolution_evidence_dimension_links(team_id, dimension_key, definition_version);

-- Every stable evidence identity receives immutable version 1 automatically.
CREATE OR REPLACE FUNCTION evolution_private.seed_evolution_evidence_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.evolution_evidence_versions(
    team_id, evidence_item_id, version_number, source_type, title,
    observation, source_locator, occurred_at, source_metadata, created_by
  ) VALUES (
    NEW.team_id, NEW.id, 1,
    current_setting('app.evolution_evidence_source_type', true),
    current_setting('app.evolution_evidence_title', true),
    current_setting('app.evolution_evidence_observation', true),
    NULLIF(current_setting('app.evolution_evidence_source_locator', true), ''),
    NULLIF(current_setting('app.evolution_evidence_occurred_at', true), '')::timestamptz,
    COALESCE(NULLIF(current_setting('app.evolution_evidence_source_metadata', true), '')::jsonb, '{}'::jsonb),
    NEW.created_by
  );
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION evolution_private.seed_evolution_evidence_version()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_evidence_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  expected_version integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Evidence versions are append-only; create a new version'
      USING ERRCODE = '55000';
  END IF;
  SELECT COALESCE(max(v.version_number), 0) + 1
    INTO expected_version
    FROM public.evolution_evidence_versions v
    WHERE v.evidence_item_id = NEW.evidence_item_id;
  IF NEW.version_number <> expected_version THEN
    RAISE EXCEPTION 'Evidence version must be sequential (expected %, received %)',
      expected_version, NEW.version_number
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION evolution_private.guard_evolution_evidence_version()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.reject_evolution_evidence_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Evidence identity and evaluation context are immutable'
    USING ERRCODE = '55000';
END;
$function$;
REVOKE ALL ON FUNCTION evolution_private.reject_evolution_evidence_identity_mutation()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.reject_evolution_evidence_link_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Evidence dimension links are immutable; add a corrected link'
    USING ERRCODE = '55000';
END;
$function$;
REVOKE ALL ON FUNCTION evolution_private.reject_evolution_evidence_link_mutation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS evolution_evidence_seed_first_version ON public.evolution_evidence_items;
CREATE TRIGGER evolution_evidence_seed_first_version
AFTER INSERT ON public.evolution_evidence_items
FOR EACH ROW EXECUTE FUNCTION evolution_private.seed_evolution_evidence_version();

DROP TRIGGER IF EXISTS evolution_evidence_versions_append_only ON public.evolution_evidence_versions;
CREATE TRIGGER evolution_evidence_versions_append_only
BEFORE INSERT OR UPDATE OR DELETE ON public.evolution_evidence_versions
FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_evidence_version();

DROP TRIGGER IF EXISTS evolution_evidence_identity_immutable ON public.evolution_evidence_items;
CREATE TRIGGER evolution_evidence_identity_immutable
BEFORE UPDATE OR DELETE ON public.evolution_evidence_items
FOR EACH ROW EXECUTE FUNCTION evolution_private.reject_evolution_evidence_identity_mutation();

DROP TRIGGER IF EXISTS evolution_evidence_links_immutable ON public.evolution_evidence_dimension_links;
CREATE TRIGGER evolution_evidence_links_immutable
BEFORE UPDATE OR DELETE ON public.evolution_evidence_dimension_links
FOR EACH ROW EXECUTE FUNCTION evolution_private.reject_evolution_evidence_link_mutation();

ALTER TABLE public.evolution_evaluation_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_evidence_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_evidence_dimension_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.evolution_evaluation_contexts,
  public.evolution_evidence_items, public.evolution_evidence_versions,
  public.evolution_evidence_dimension_links FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON public.evolution_evaluation_contexts TO authenticated;
GRANT SELECT, INSERT ON public.evolution_evidence_items TO authenticated;
GRANT SELECT, INSERT ON public.evolution_evidence_versions TO authenticated;
GRANT SELECT, INSERT ON public.evolution_evidence_dimension_links TO authenticated;

CREATE POLICY evolution_evaluation_contexts_team_read
ON public.evolution_evaluation_contexts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.id = evolution_evaluation_contexts.player_member_id
    AND tm.team_id = evolution_evaluation_contexts.team_id
    AND tm.user_id = evolution_evaluation_contexts.player_user_id
    AND tm.status = 'active'
    AND tm.user_id = (SELECT auth.uid())
  UNION ALL
  SELECT 1 FROM public.team_members tm
  WHERE tm.team_id = evolution_evaluation_contexts.team_id
    AND tm.user_id = (SELECT auth.uid())
    AND tm.status = 'active'
));
CREATE POLICY evolution_evaluation_contexts_staff_insert
ON public.evolution_evaluation_contexts FOR INSERT TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = evolution_evaluation_contexts.team_id
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
);

CREATE POLICY evolution_evidence_items_visibility_read
ON public.evolution_evidence_items FOR SELECT TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR (
    visibility = 'team' AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_evidence_items.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
    )
  )
  OR (
    visibility = 'coaches' AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_evidence_items.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
        AND tm.membership_role IN ('owner', 'coach')
    )
  )
);
CREATE POLICY evolution_evidence_items_staff_insert
ON public.evolution_evidence_items FOR INSERT TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = evolution_evidence_items.team_id
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
  AND EXISTS (
    SELECT 1 FROM public.evolution_evaluation_contexts c
    WHERE c.id = evolution_evidence_items.evaluation_context_id
      AND c.team_id = evolution_evidence_items.team_id
  )
);

CREATE POLICY evolution_evidence_versions_visibility_read
ON public.evolution_evidence_versions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.evolution_evidence_items e
  WHERE e.id = evolution_evidence_versions.evidence_item_id
    AND e.team_id = evolution_evidence_versions.team_id
));
CREATE POLICY evolution_evidence_versions_staff_insert
ON public.evolution_evidence_versions FOR INSERT TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.evolution_evidence_items e
    JOIN public.team_members tm ON tm.team_id = e.team_id
    WHERE e.id = evolution_evidence_versions.evidence_item_id
      AND e.team_id = evolution_evidence_versions.team_id
      AND (e.created_by = (SELECT auth.uid()) OR tm.membership_role IN ('owner','coach'))
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
  )
);

CREATE POLICY evolution_evidence_dimension_links_visibility_read
ON public.evolution_evidence_dimension_links FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.evolution_evidence_items e
  WHERE e.id = evolution_evidence_dimension_links.evidence_item_id
    AND e.team_id = evolution_evidence_dimension_links.team_id
));
CREATE POLICY evolution_evidence_dimension_links_staff_insert
ON public.evolution_evidence_dimension_links FOR INSERT TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.evolution_evidence_items e
    JOIN public.team_members tm ON tm.team_id = e.team_id
    WHERE e.id = evolution_evidence_dimension_links.evidence_item_id
      AND e.team_id = evolution_evidence_dimension_links.team_id
      AND (e.created_by = (SELECT auth.uid()) OR tm.membership_role IN ('owner','coach'))
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
  )
);

COMMENT ON TABLE public.evolution_evaluation_contexts IS
  'Immutable player/session/match/role-snapshot anchor for a future versioned evaluation; does not itself calculate or finalize a score.';
COMMENT ON TABLE public.evolution_evidence_items IS
  'Stable identity and visibility envelope for one evidence observation; content is stored in append-only versions.';
COMMENT ON TABLE public.evolution_evidence_versions IS
  'Append-only evidence content history. Version 1 is seeded with the evidence identity; corrections add a later version.';
COMMENT ON TABLE public.evolution_evidence_dimension_links IS
  'Immutable links from evidence to an exact canonical dimension definition version.';
