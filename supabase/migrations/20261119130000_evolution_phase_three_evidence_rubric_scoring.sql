-- Evolution Phase Three — Evidence, canonical rubric and scoring contracts.
-- Additive only. This migration is intentionally NOT applied to production in this phase.
-- No evaluation submissions or legacy score rows are rewritten here.

CREATE UNIQUE INDEX IF NOT EXISTS team_members_id_team_evolution_uidx
  ON public.team_members (id, team_id);

CREATE TABLE IF NOT EXISTS public.evolution_rubric_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE RESTRICT,
  version_code text NOT NULL CHECK (char_length(btrim(version_code)) BETWEEN 1 AND 40),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  scoring_engine_version text NOT NULL CHECK (char_length(btrim(scoring_engine_version)) BETWEEN 1 AND 40),
  minimum_observed_dimensions integer NOT NULL CHECK (minimum_observed_dimensions BETWEEN 1 AND 6),
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  CONSTRAINT evolution_rubric_system_scope CHECK ((is_system AND team_id IS NULL) OR (NOT is_system AND team_id IS NOT NULL)),
  CONSTRAINT evolution_rubric_activation_pair CHECK ((status = 'draft' AND activated_at IS NULL) OR (status IN ('active', 'retired') AND activated_at IS NOT NULL)),
  CONSTRAINT evolution_rubric_version_team_unique UNIQUE (id, team_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS evolution_rubric_system_version_uidx
  ON public.evolution_rubric_versions (version_code) WHERE is_system;
CREATE UNIQUE INDEX IF NOT EXISTS evolution_rubric_team_version_uidx
  ON public.evolution_rubric_versions (team_id, version_code) WHERE NOT is_system;
CREATE UNIQUE INDEX IF NOT EXISTS evolution_rubric_one_system_active_uidx
  ON public.evolution_rubric_versions ((is_system)) WHERE is_system AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS evolution_rubric_one_team_active_uidx
  ON public.evolution_rubric_versions (team_id) WHERE NOT is_system AND status = 'active';

CREATE TABLE IF NOT EXISTS public.evolution_rubric_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_version_id uuid NOT NULL REFERENCES public.evolution_rubric_versions(id) ON DELETE RESTRICT,
  dimension_key text NOT NULL CHECK (dimension_key IN (
    'communication',
    'coordination_trade_support',
    'decision_making',
    'positioning',
    'map_awareness_rotation',
    'role_execution'
  )),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  definition text NOT NULL CHECK (char_length(btrim(definition)) BETWEEN 1 AND 800),
  sort_order smallint NOT NULL CHECK (sort_order BETWEEN 1 AND 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evolution_rubric_dimension_key_unique UNIQUE (rubric_version_id, dimension_key),
  CONSTRAINT evolution_rubric_dimension_order_unique UNIQUE (rubric_version_id, sort_order),
  CONSTRAINT evolution_rubric_dimension_version_pair UNIQUE (id, rubric_version_id)
);

CREATE TABLE IF NOT EXISTS public.evolution_role_weight_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE RESTRICT,
  rubric_version_id uuid NOT NULL REFERENCES public.evolution_rubric_versions(id) ON DELETE RESTRICT,
  role_key text NOT NULL CHECK (role_key IN (
    'primary_rusher',
    'secondary_rusher',
    'third_rusher_flanker',
    'sniper_igl',
    'substitute_flex',
    'other'
  )),
  version_code text NOT NULL CHECK (char_length(btrim(version_code)) BETWEEN 1 AND 40),
  weights jsonb NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  CONSTRAINT evolution_role_profile_scope CHECK ((is_system AND team_id IS NULL) OR (NOT is_system AND team_id IS NOT NULL)),
  CONSTRAINT evolution_role_profile_activation_pair CHECK ((status = 'draft' AND activated_at IS NULL) OR (status IN ('active', 'retired') AND activated_at IS NOT NULL)),
  CONSTRAINT evolution_role_profile_weights_shape CHECK (
    jsonb_typeof(weights) = 'object'
    AND (weights - ARRAY['communication','coordination_trade_support','decision_making','positioning','map_awareness_rotation','role_execution']) = '{}'::jsonb
    AND weights ?& ARRAY[
      'communication',
      'coordination_trade_support',
      'decision_making',
      'positioning',
      'map_awareness_rotation',
      'role_execution'
    ]
    AND jsonb_typeof(weights->'communication') = 'number'
    AND jsonb_typeof(weights->'coordination_trade_support') = 'number'
    AND jsonb_typeof(weights->'decision_making') = 'number'
    AND jsonb_typeof(weights->'positioning') = 'number'
    AND jsonb_typeof(weights->'map_awareness_rotation') = 'number'
    AND jsonb_typeof(weights->'role_execution') = 'number'
    AND (weights->>'communication')::numeric >= 0
    AND (weights->>'coordination_trade_support')::numeric >= 0
    AND (weights->>'decision_making')::numeric >= 0
    AND (weights->>'positioning')::numeric >= 0
    AND (weights->>'map_awareness_rotation')::numeric >= 0
    AND (weights->>'role_execution')::numeric >= 0
    AND (
      (weights->>'communication')::numeric
      + (weights->>'coordination_trade_support')::numeric
      + (weights->>'decision_making')::numeric
      + (weights->>'positioning')::numeric
      + (weights->>'map_awareness_rotation')::numeric
      + (weights->>'role_execution')::numeric
    ) > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS evolution_role_system_version_uidx
  ON public.evolution_role_weight_profiles (rubric_version_id, role_key, version_code) WHERE is_system;
CREATE UNIQUE INDEX IF NOT EXISTS evolution_role_team_version_uidx
  ON public.evolution_role_weight_profiles (team_id, rubric_version_id, role_key, version_code) WHERE NOT is_system;
CREATE UNIQUE INDEX IF NOT EXISTS evolution_role_one_system_active_uidx
  ON public.evolution_role_weight_profiles (rubric_version_id, role_key) WHERE is_system AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS evolution_role_one_team_active_uidx
  ON public.evolution_role_weight_profiles (team_id, rubric_version_id, role_key) WHERE NOT is_system AND status = 'active';

CREATE TABLE IF NOT EXISTS public.evolution_evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid,
  player_member_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('manual_observation', 'vod_reference', 'round_note', 'match_reference')),
  visibility text NOT NULL DEFAULT 'coaches' CHECK (visibility IN ('team', 'coaches', 'private')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 4000),
  source_reference text CHECK (source_reference IS NULL OR char_length(source_reference) <= 2048),
  round_label text CHECK (round_label IS NULL OR char_length(round_label) <= 80),
  occurred_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  archive_reason text CHECK (archive_reason IS NULL OR char_length(archive_reason) <= 500),
  CONSTRAINT evolution_evidence_archive_actor_pair CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  CONSTRAINT evolution_evidence_player_team_fk FOREIGN KEY (player_member_id, team_id)
    REFERENCES public.team_members (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evidence_session_team_fk FOREIGN KEY (canonical_session_id, team_id)
    REFERENCES public.canonical_sessions (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evidence_id_team_unique UNIQUE (id, team_id)
);

CREATE INDEX IF NOT EXISTS evolution_evidence_team_player_time_idx
  ON public.evolution_evidence_items (team_id, player_member_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS evolution_evidence_session_idx
  ON public.evolution_evidence_items (canonical_session_id) WHERE canonical_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.evolution_evidence_dimension_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  evidence_item_id uuid NOT NULL,
  rubric_version_id uuid NOT NULL,
  rubric_dimension_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evolution_evidence_link_evidence_team_fk FOREIGN KEY (evidence_item_id, team_id)
    REFERENCES public.evolution_evidence_items (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evidence_link_dimension_version_fk FOREIGN KEY (rubric_dimension_id, rubric_version_id)
    REFERENCES public.evolution_rubric_dimensions (id, rubric_version_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evidence_link_unique UNIQUE (evidence_item_id, rubric_dimension_id)
);

CREATE INDEX IF NOT EXISTS evolution_evidence_links_team_idx
  ON public.evolution_evidence_dimension_links (team_id, rubric_version_id, rubric_dimension_id);

-- Seed one immutable, neutral system rubric. Team-specific role weights can be
-- introduced as new versions after coach/owner review; no arbitrary role bias is assumed.
INSERT INTO public.evolution_rubric_versions (
  team_id, version_code, title, status, scoring_engine_version,
  minimum_observed_dimensions, is_system, activated_at
)
SELECT NULL, 'EV2-1.0', 'Canonical Six-Dimension Rubric', 'active', 'score-1.0', 4, true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.evolution_rubric_versions
  WHERE is_system AND version_code = 'EV2-1.0'
);

INSERT INTO public.evolution_rubric_dimensions (rubric_version_id, dimension_key, label, definition, sort_order)
SELECT v.id, d.dimension_key, d.label, d.definition, d.sort_order
FROM public.evolution_rubric_versions v
CROSS JOIN (VALUES
  ('communication', 'Communication', 'Timely, clear, accurate and actionable information; usefulness matters more than callout volume.', 1),
  ('coordination_trade_support', 'Coordination & Trade Support', 'Team timing, spacing, acknowledgement and support behavior; not simply an outcome or elimination count.', 2),
  ('decision_making', 'Decision Making', 'Decision quality in its observed context, independent of hindsight or outcome alone.', 3),
  ('positioning', 'Positioning', 'Cover, angles, spacing, exposure and safe repositioning in the observed context.', 4),
  ('map_awareness_rotation', 'Map Awareness & Rotation', 'Reading map/zone information, timing and route context; distinct from positioning.', 5),
  ('role_execution', 'Role Execution', 'Execution of the role actually recorded for that session, not a mutable current roster label.', 6)
) AS d(dimension_key, label, definition, sort_order)
WHERE v.is_system AND v.version_code = 'EV2-1.0'
  AND NOT EXISTS (
    SELECT 1 FROM public.evolution_rubric_dimensions existing
    WHERE existing.rubric_version_id = v.id AND existing.dimension_key = d.dimension_key
  );

-- Start with a neutral 1.0 weight for each dimension for every role. This avoids
-- inventing a role advantage; staff can create a reviewed, versioned profile later.
INSERT INTO public.evolution_role_weight_profiles (
  team_id, rubric_version_id, role_key, version_code, weights,
  is_system, status, activated_at
)
SELECT NULL, v.id, r.role_key, 'neutral-1.0',
  '{"communication":1,"coordination_trade_support":1,"decision_making":1,"positioning":1,"map_awareness_rotation":1,"role_execution":1}'::jsonb,
  true, 'active', now()
FROM public.evolution_rubric_versions v
CROSS JOIN (VALUES
  ('primary_rusher'), ('secondary_rusher'), ('third_rusher_flanker'),
  ('sniper_igl'), ('substitute_flex'), ('other')
) AS r(role_key)
WHERE v.is_system AND v.version_code = 'EV2-1.0'
  AND NOT EXISTS (
    SELECT 1 FROM public.evolution_role_weight_profiles existing
    WHERE existing.rubric_version_id = v.id AND existing.role_key = r.role_key
      AND existing.is_system AND existing.version_code = 'neutral-1.0'
  );

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'evolution_rubric_versions',
    'evolution_rubric_dimensions',
    'evolution_role_weight_profiles',
    'evolution_evidence_items',
    'evolution_evidence_dimension_links'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

GRANT SELECT ON public.evolution_rubric_versions, public.evolution_rubric_dimensions,
  public.evolution_role_weight_profiles TO authenticated;
GRANT INSERT ON public.evolution_rubric_versions,
  public.evolution_role_weight_profiles, public.evolution_rubric_dimensions TO authenticated;
GRANT UPDATE (status, activated_at) ON public.evolution_rubric_versions TO authenticated;
GRANT UPDATE (weights, status, activated_at) ON public.evolution_role_weight_profiles TO authenticated;
GRANT UPDATE (label, definition, sort_order) ON public.evolution_rubric_dimensions TO authenticated;
GRANT INSERT, UPDATE (archived_at, archived_by, archive_reason) ON public.evolution_evidence_items TO authenticated;
GRANT INSERT ON public.evolution_evidence_dimension_links TO authenticated;
GRANT SELECT ON public.evolution_evidence_items,
  public.evolution_evidence_dimension_links TO authenticated;
REVOKE DELETE ON public.evolution_rubric_versions, public.evolution_rubric_dimensions,
  public.evolution_role_weight_profiles, public.evolution_evidence_items,
  public.evolution_evidence_dimension_links FROM anon, authenticated;

-- Keep the cross-table activation invariant out of the RLS policy graph.
-- The former policy queried rubric_dimensions while that table's SELECT policy
-- queried rubric_versions, causing PostgreSQL's infinite RLS recursion error.
-- This private trigger function checks only the invariant and returns no data.
CREATE SCHEMA IF NOT EXISTS evolution_private;
REVOKE ALL ON SCHEMA evolution_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.enforce_evolution_rubric_dimensions_before_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actual_dimension_count integer;
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT count(*)
      INTO actual_dimension_count
      FROM public.evolution_rubric_dimensions d
      WHERE d.rubric_version_id = NEW.id;

    IF actual_dimension_count <> 6 THEN
      RAISE EXCEPTION
        'A rubric version requires exactly 6 dimensions before activation (found %)',
        actual_dimension_count
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.enforce_evolution_rubric_dimensions_before_activation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER evolution_rubric_dimensions_before_activation
  BEFORE UPDATE OF status ON public.evolution_rubric_versions
  FOR EACH ROW
  EXECUTE FUNCTION evolution_private.enforce_evolution_rubric_dimensions_before_activation();

CREATE POLICY evolution_rubric_versions_read ON public.evolution_rubric_versions
  FOR SELECT TO authenticated
  USING (
    is_system OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_rubric_versions.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
    )
  );
CREATE POLICY evolution_rubric_versions_staff_insert ON public.evolution_rubric_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT is_system AND status = 'draft' AND activated_at IS NULL
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_rubric_versions.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
        AND tm.membership_role IN ('owner', 'coach')
    )
  );
CREATE POLICY evolution_rubric_versions_staff_update ON public.evolution_rubric_versions
  FOR UPDATE TO authenticated
  USING (
    NOT is_system AND status = 'draft' AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_rubric_versions.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
        AND tm.membership_role IN ('owner', 'coach')
    )
  )
  WITH CHECK (
    NOT is_system AND (
      (status = 'draft' AND activated_at IS NULL) OR
      (status = 'active' AND activated_at IS NOT NULL)
    ) AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_rubric_versions.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
        AND tm.membership_role IN ('owner', 'coach')
    )
  );

CREATE POLICY evolution_rubric_dimensions_read ON public.evolution_rubric_dimensions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evolution_rubric_versions v
    WHERE v.id = evolution_rubric_dimensions.rubric_version_id
      AND (v.is_system OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = v.team_id AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
      ))
  ));

CREATE POLICY evolution_rubric_dimensions_staff_insert ON public.evolution_rubric_dimensions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evolution_rubric_versions v
    JOIN public.team_members tm ON tm.team_id = v.team_id
    WHERE v.id = evolution_rubric_dimensions.rubric_version_id
      AND v.is_system = false AND v.status = 'draft'
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  ));
CREATE POLICY evolution_rubric_dimensions_staff_update ON public.evolution_rubric_dimensions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evolution_rubric_versions v
    JOIN public.team_members tm ON tm.team_id = v.team_id
    WHERE v.id = evolution_rubric_dimensions.rubric_version_id
      AND v.is_system = false AND v.status = 'draft'
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.evolution_rubric_versions v
    JOIN public.team_members tm ON tm.team_id = v.team_id
    WHERE v.id = evolution_rubric_dimensions.rubric_version_id
      AND v.is_system = false AND v.status = 'draft'
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  ));

CREATE POLICY evolution_role_profiles_read ON public.evolution_role_weight_profiles
  FOR SELECT TO authenticated
  USING (
    is_system OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_role_weight_profiles.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
    )
  );
CREATE POLICY evolution_role_profiles_staff_insert ON public.evolution_role_weight_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT is_system AND status = 'draft' AND activated_at IS NULL AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_role_weight_profiles.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
        AND tm.membership_role IN ('owner', 'coach')
    )
    AND EXISTS (
      SELECT 1 FROM public.evolution_rubric_versions v
      WHERE v.id = evolution_role_weight_profiles.rubric_version_id
        AND v.team_id = evolution_role_weight_profiles.team_id AND v.status = 'active'
    )
  );
CREATE POLICY evolution_role_profiles_staff_update ON public.evolution_role_weight_profiles
  FOR UPDATE TO authenticated
  USING (
    NOT is_system AND status <> 'retired' AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_role_weight_profiles.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
        AND tm.membership_role IN ('owner', 'coach')
    )
  )
  WITH CHECK (
    NOT is_system AND (
      (status = 'draft' AND activated_at IS NULL) OR
      (status = 'active' AND activated_at IS NOT NULL)
    ) AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_role_weight_profiles.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
        AND tm.membership_role IN ('owner', 'coach')
    )
  );

CREATE POLICY evolution_evidence_read ON public.evolution_evidence_items
  FOR SELECT TO authenticated
  USING (
    archived_at IS NULL AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_evidence_items.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
        AND (
          evolution_evidence_items.created_by = (SELECT auth.uid())
          OR evolution_evidence_items.visibility = 'team'
          OR (
            evolution_evidence_items.visibility = 'coaches'
            AND tm.membership_role IN ('owner', 'coach')
          )
        )
    )
  );
CREATE POLICY evolution_evidence_member_insert ON public.evolution_evidence_items
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = evolution_evidence_items.team_id
        AND tm.id = evolution_evidence_items.player_member_id
        AND tm.status = 'active'
        AND EXISTS (
          SELECT 1 FROM public.team_members actor
          WHERE actor.team_id = evolution_evidence_items.team_id
            AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
        )
    )
  );
CREATE POLICY evolution_evidence_staff_archive ON public.evolution_evidence_items
  FOR UPDATE TO authenticated
  USING (
    archived_at IS NULL AND EXISTS (
      SELECT 1 FROM public.team_members actor
      WHERE actor.team_id = evolution_evidence_items.team_id
        AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
        AND (
          actor.membership_role IN ('owner', 'coach')
        )
    )
  )
  WITH CHECK (
    archived_at IS NOT NULL AND archived_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.team_members actor
      WHERE actor.team_id = evolution_evidence_items.team_id
        AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
        AND (
          evolution_evidence_items.created_by = (SELECT auth.uid())
          OR actor.membership_role IN ('owner', 'coach')
        )
    )
  );

CREATE POLICY evolution_evidence_links_read ON public.evolution_evidence_dimension_links
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.evolution_evidence_items e
    WHERE e.id = evolution_evidence_dimension_links.evidence_item_id
      AND e.team_id = evolution_evidence_dimension_links.team_id
  ));
CREATE POLICY evolution_evidence_links_insert ON public.evolution_evidence_dimension_links
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.evolution_evidence_items e
      WHERE e.id = evolution_evidence_dimension_links.evidence_item_id
        AND e.team_id = evolution_evidence_dimension_links.team_id
        AND e.created_by = (SELECT auth.uid()) AND e.archived_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.evolution_rubric_dimensions d
      JOIN public.evolution_rubric_versions v ON v.id = d.rubric_version_id
      WHERE d.id = evolution_evidence_dimension_links.rubric_dimension_id
        AND d.rubric_version_id = evolution_evidence_dimension_links.rubric_version_id
        AND (v.is_system OR v.team_id = evolution_evidence_dimension_links.team_id)
    )
  );

COMMENT ON TABLE public.evolution_rubric_versions IS
  'Versioned canonical six-dimension rubric. System version EV2-1.0 is immutable; team variants are versioned.';
COMMENT ON TABLE public.evolution_role_weight_profiles IS
  'Versioned role weights. Initial system profiles are neutral weights; no role-specific advantage is assumed.';
COMMENT ON TABLE public.evolution_evidence_items IS
  'Team-scoped evidence metadata with explicit visibility. External media is referenced, not copied or inferred.';
COMMENT ON TABLE public.evolution_evidence_dimension_links IS
  'Links an evidence item to dimensions from one exact rubric version.';
