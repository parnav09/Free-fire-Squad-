-- Evolution Phase 3.2 — stable canonical dimension registry.
-- Additive and feature-branch-only. Does not alter legacy scores or production data.

CREATE TABLE IF NOT EXISTS public.evolution_dimension_registry (
  dimension_key text PRIMARY KEY CHECK (dimension_key IN (
    'communication',
    'coordination_trade_support',
    'decision_making',
    'positioning',
    'map_awareness_rotation',
    'role_execution'
  )),
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'retired')),
  sort_order smallint NOT NULL CHECK (sort_order BETWEEN 1 AND 32767),
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  CONSTRAINT evolution_dimension_registry_retirement_pair
    CHECK ((lifecycle_status = 'active' AND retired_at IS NULL)
        OR (lifecycle_status = 'retired' AND retired_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.evolution_dimension_definition_versions (
  dimension_key text NOT NULL
    REFERENCES public.evolution_dimension_registry(dimension_key) ON DELETE RESTRICT,
  definition_version integer NOT NULL CHECK (definition_version >= 1),
  canonical_label text NOT NULL CHECK (char_length(btrim(canonical_label)) BETWEEN 1 AND 80),
  definition text NOT NULL CHECK (char_length(btrim(definition)) BETWEEN 1 AND 800),
  applicable_role_keys text[] NOT NULL,
  rating_min smallint NOT NULL DEFAULT 0,
  rating_max smallint NOT NULL DEFAULT 10,
  rating_step smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dimension_key, definition_version),
  CONSTRAINT evolution_dimension_definition_rating_scale
    CHECK (rating_min = 0 AND rating_max = 10 AND rating_step = 1),
  CONSTRAINT evolution_dimension_definition_roles
    CHECK (
      cardinality(applicable_role_keys) > 0
      AND applicable_role_keys <@ ARRAY[
        'primary_rusher', 'secondary_rusher', 'third_rusher_flanker',
        'sniper_igl', 'substitute_flex', 'other'
      ]::text[]
    )
);

INSERT INTO public.evolution_dimension_registry (dimension_key, lifecycle_status, sort_order)
VALUES
  ('communication', 'active', 1),
  ('coordination_trade_support', 'active', 2),
  ('decision_making', 'active', 3),
  ('positioning', 'active', 4),
  ('map_awareness_rotation', 'active', 5),
  ('role_execution', 'active', 6)
ON CONFLICT (dimension_key) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS evolution_dimension_registry_active_order_uidx
  ON public.evolution_dimension_registry (sort_order)
  WHERE lifecycle_status = 'active';

INSERT INTO public.evolution_dimension_definition_versions (
  dimension_key, definition_version, canonical_label, definition, applicable_role_keys,
  rating_min, rating_max, rating_step
)
VALUES
  ('communication', 1, 'Communication',
   'Timely, clear, accurate and actionable information; usefulness matters more than callout volume.',
   ARRAY['primary_rusher','secondary_rusher','third_rusher_flanker','sniper_igl','substitute_flex','other'], 0, 10, 1),
  ('coordination_trade_support', 1, 'Coordination & Trade Support',
   'Team timing, spacing, acknowledgement and support behavior; not simply an outcome or elimination count.',
   ARRAY['primary_rusher','secondary_rusher','third_rusher_flanker','sniper_igl','substitute_flex','other'], 0, 10, 1),
  ('decision_making', 1, 'Decision Making',
   'Decision quality in its observed context, independent of hindsight or outcome alone.',
   ARRAY['primary_rusher','secondary_rusher','third_rusher_flanker','sniper_igl','substitute_flex','other'], 0, 10, 1),
  ('positioning', 1, 'Positioning',
   'Cover, angles, spacing, exposure and safe repositioning in the observed context.',
   ARRAY['primary_rusher','secondary_rusher','third_rusher_flanker','sniper_igl','substitute_flex','other'], 0, 10, 1),
  ('map_awareness_rotation', 1, 'Map Awareness & Rotation',
   'Reading map/zone information, timing and route context; distinct from positioning.',
   ARRAY['primary_rusher','secondary_rusher','third_rusher_flanker','sniper_igl','substitute_flex','other'], 0, 10, 1),
  ('role_execution', 1, 'Role Execution',
   'Execution of the role actually recorded for that session, not a mutable current roster label.',
   ARRAY['primary_rusher','secondary_rusher','third_rusher_flanker','sniper_igl','substitute_flex','other'], 0, 10, 1)
ON CONFLICT (dimension_key, definition_version) DO NOTHING;

-- Legacy aliases are recorded only where the audit found semantic equivalence.
-- Partial concepts (e.g. coordination without trade support) are intentionally unmapped.
CREATE TABLE IF NOT EXISTS public.evolution_dimension_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL CHECK (source_system IN (
    'daily_evaluation', 'standard_training', 'advanced_training'
  )),
  legacy_key text NOT NULL CHECK (char_length(btrim(legacy_key)) BETWEEN 1 AND 80),
  dimension_key text NOT NULL
    REFERENCES public.evolution_dimension_registry(dimension_key) ON DELETE RESTRICT,
  mapping_kind text NOT NULL DEFAULT 'exact' CHECK (mapping_kind = 'exact'),
  rationale text NOT NULL CHECK (char_length(btrim(rationale)) BETWEEN 1 AND 400),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, legacy_key)
);

INSERT INTO public.evolution_dimension_aliases
  (source_system, legacy_key, dimension_key, mapping_kind, rationale)
VALUES
  ('daily_evaluation', 'communication', 'communication', 'exact',
   'The legacy category measures communication directly.'),
  ('daily_evaluation', 'decision_making', 'decision_making', 'exact',
   'The legacy category measures decision making directly.'),
  ('daily_evaluation', 'role_execution', 'role_execution', 'exact',
   'The legacy category measures role execution directly.'),
  ('standard_training', 'communication', 'communication', 'exact',
   'The legacy category measures communication directly.'),
  ('advanced_training', 'communication', 'communication', 'exact',
   'The legacy category measures communication directly.'),
  ('advanced_training', 'decision_making', 'decision_making', 'exact',
   'The legacy category measures decision making directly.'),
  ('advanced_training', 'positioning', 'positioning', 'exact',
   'The legacy category measures positioning directly.')
ON CONFLICT (source_system, legacy_key) DO NOTHING;

ALTER TABLE public.evolution_rubric_dimensions
  ADD COLUMN IF NOT EXISTS registry_definition_version integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evolution_rubric_dimension_registry_fk'
      AND conrelid = 'public.evolution_rubric_dimensions'::regclass
  ) THEN
    ALTER TABLE public.evolution_rubric_dimensions
      ADD CONSTRAINT evolution_rubric_dimension_registry_fk
      FOREIGN KEY (dimension_key)
      REFERENCES public.evolution_dimension_registry(dimension_key) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evolution_rubric_dimension_definition_version_fk'
      AND conrelid = 'public.evolution_rubric_dimensions'::regclass
  ) THEN
    ALTER TABLE public.evolution_rubric_dimensions
      ADD CONSTRAINT evolution_rubric_dimension_definition_version_fk
      FOREIGN KEY (dimension_key, registry_definition_version)
      REFERENCES public.evolution_dimension_definition_versions(dimension_key, definition_version)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Prevent new rubric definitions from using a retired canonical dimension.
CREATE OR REPLACE FUNCTION evolution_private.enforce_active_evolution_dimension_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  dimension_status text;
BEGIN
  SELECT r.lifecycle_status
    INTO dimension_status
    FROM public.evolution_dimension_registry r
    WHERE r.dimension_key = NEW.dimension_key;

  IF dimension_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Canonical dimension % is not active', NEW.dimension_key
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.enforce_active_evolution_dimension_registry()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER evolution_rubric_dimension_requires_active_registry
  BEFORE INSERT OR UPDATE OF dimension_key, registry_definition_version
  ON public.evolution_rubric_dimensions
  FOR EACH ROW
  EXECUTE FUNCTION evolution_private.enforce_active_evolution_dimension_registry();

CREATE INDEX IF NOT EXISTS evolution_dimension_alias_lookup_idx
  ON public.evolution_dimension_aliases (source_system, legacy_key);

ALTER TABLE public.evolution_dimension_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_dimension_definition_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolution_dimension_aliases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.evolution_dimension_registry,
  public.evolution_dimension_definition_versions,
  public.evolution_dimension_aliases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.evolution_dimension_registry,
  public.evolution_dimension_definition_versions,
  public.evolution_dimension_aliases TO authenticated;

CREATE POLICY evolution_dimension_registry_authenticated_read
  ON public.evolution_dimension_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY evolution_dimension_definition_versions_authenticated_read
  ON public.evolution_dimension_definition_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY evolution_dimension_aliases_authenticated_read
  ON public.evolution_dimension_aliases FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.evolution_dimension_registry IS
  'Stable canonical dimension identifiers and lifecycle state; display labels are not identifiers.';
COMMENT ON TABLE public.evolution_dimension_definition_versions IS
  'Immutable, versioned canonical definitions, applicability and 0–10 integer rating-scale metadata.';
COMMENT ON TABLE public.evolution_dimension_aliases IS
  'Exact-semantic legacy aliases only. Non-equivalent legacy dimensions are intentionally unmapped.';
COMMENT ON COLUMN public.evolution_rubric_dimensions.registry_definition_version IS
  'Canonical registry definition version referenced when this rubric dimension was authored.';
