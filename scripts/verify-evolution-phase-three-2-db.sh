#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122130000_evolution_phase_three_2_canonical_dimension_registry.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END
$$;
SQL

# Run twice to verify the additive migration is safely repeatable in a clean test DB.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  registry_count integer;
  version_count integer;
  alias_count integer;
BEGIN
  SELECT count(*) INTO registry_count FROM public.evolution_dimension_registry
    WHERE lifecycle_status = 'active';
  IF registry_count <> 6 THEN RAISE EXCEPTION 'expected 6 active dimensions, got %', registry_count; END IF;

  SELECT count(*) INTO version_count FROM public.evolution_dimension_definition_versions
    WHERE definition_version = 1 AND rating_min = 0 AND rating_max = 10 AND rating_step = 1
      AND cardinality(applicable_role_keys) = 6;
  IF version_count <> 6 THEN RAISE EXCEPTION 'expected 6 version-1 definitions with all roles and 0–10 scale, got %', version_count; END IF;

  SELECT count(*) INTO alias_count FROM public.evolution_dimension_aliases;
  IF alias_count <> 7 THEN RAISE EXCEPTION 'expected 7 exact legacy aliases, got %', alias_count; END IF;

  IF EXISTS (
    SELECT 1 FROM public.evolution_dimension_aliases
    WHERE mapping_kind <> 'exact'
       OR legacy_key IN ('coordination', 'trade_support', 'map_awareness', 'consistency')
  ) THEN RAISE EXCEPTION 'unsafe or non-exact legacy alias exists'; END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.evolution_dimension_registry(dimension_key, lifecycle_status, sort_order)
    VALUES ('not_a_canonical_dimension', 'active', 99);
    RAISE EXCEPTION 'unknown dimension key unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.evolution_dimension_registry SET sort_order = 2
    WHERE dimension_key = 'communication';
    RAISE EXCEPTION 'duplicate active order unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.evolution_dimension_definition_versions
    SET canonical_label = 'Mutated label'
    WHERE dimension_key = 'communication' AND definition_version = 1;
    RAISE EXCEPTION 'definition version unexpectedly mutated';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;

  BEGIN
    DELETE FROM public.evolution_dimension_definition_versions
    WHERE dimension_key = 'communication' AND definition_version = 1;
    RAISE EXCEPTION 'definition version unexpectedly deleted';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;

  BEGIN
    UPDATE public.evolution_dimension_aliases
    SET rationale = 'Mutated rationale'
    WHERE source_system = 'daily_evaluation' AND legacy_key = 'communication';
    RAISE EXCEPTION 'legacy alias unexpectedly mutated';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;

  BEGIN
    INSERT INTO public.evolution_dimension_definition_versions(
      dimension_key, definition_version, canonical_label, definition,
      applicable_role_keys, rating_min, rating_max, rating_step
    ) VALUES (
      'communication', 2, 'Communication v2', 'A new version.',
      ARRAY['primary_rusher','primary_rusher'], 0, 10, 1
    );
    RAISE EXCEPTION 'duplicate role applicability unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.evolution_dimension_definition_versions(
      dimension_key, definition_version, canonical_label, definition,
      applicable_role_keys, rating_min, rating_max, rating_step
    ) VALUES (
      'communication', 3, 'Communication v3', 'An invalid scale.',
      ARRAY['primary_rusher'], 0, 11, 1
    );
    RAISE EXCEPTION 'invalid rating scale unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$$;

UPDATE public.evolution_dimension_registry
SET lifecycle_status = 'retired'
WHERE dimension_key = 'communication';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.evolution_dimension_registry
    WHERE dimension_key = 'communication'
      AND lifecycle_status = 'retired' AND retired_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'retirement timestamp was not recorded'; END IF;

  BEGIN
    UPDATE public.evolution_dimension_registry
    SET lifecycle_status = 'active', retired_at = NULL
    WHERE dimension_key = 'communication';
    RAISE EXCEPTION 'retired dimension unexpectedly reactivated';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$$;

SET ROLE authenticated;
DO $$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.evolution_dimension_registry;
  IF visible_count <> 5 THEN RAISE EXCEPTION 'authenticated registry read expected 5 active+retired rows, got %', visible_count; END IF;

  BEGIN
    INSERT INTO public.evolution_dimension_registry(dimension_key, lifecycle_status, sort_order)
    VALUES ('communication', 'active', 1);
    RAISE EXCEPTION 'authenticated client unexpectedly has registry write access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.evolution_dimension_registry', 'SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has registry read access';
  END IF;
  IF has_table_privilege('authenticated', 'public.evolution_dimension_registry', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated unexpectedly has registry update access';
  END IF;
  IF has_table_privilege('authenticated', 'public.evolution_dimension_aliases', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated unexpectedly has alias delete access';
  END IF;
END
$$;

SELECT 'Evolution Phase 3.2 canonical dimension registry PostgreSQL PASS' AS result;
SQL
