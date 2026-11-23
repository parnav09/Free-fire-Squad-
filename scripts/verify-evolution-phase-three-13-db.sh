#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Rebuild and verify the complete Phase 3.2–3.12 dependency chain first.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-three-12-db.sh"

# Apply the additive Phase 3.13 transaction boundary in this disposable database.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261122220000_evolution_phase_three_13_atomic_context_creation.sql"

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_signature regprocedure;
  v_security_definer boolean;
  v_config text[];
  v_definition text;
BEGIN
  SELECT p.oid::regprocedure,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid)
    INTO v_signature,v_security_definer,v_config,v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='create_evolution_evaluation_context';

  IF v_signature IS NULL THEN
    RAISE EXCEPTION 'Atomic evaluation context RPC was not installed';
  END IF;
  IF NOT v_security_definer THEN
    RAISE EXCEPTION 'Atomic evaluation context RPC must be SECURITY DEFINER';
  END IF;
  IF NOT ('search_path=""' = ANY(COALESCE(v_config,ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'Atomic evaluation context RPC must pin an empty search_path';
  END IF;
  IF has_function_privilege('anon',v_signature,'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous users must not execute the atomic evaluation context RPC';
  END IF;
  IF NOT has_function_privilege('authenticated',v_signature,'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated team staff must have the explicit RPC grant';
  END IF;
  IF position('evolution_evaluation_rubric_bindings' in v_definition)=0
    OR position('evolution_evaluation_role_weight_bindings' in v_definition)=0
    OR position('canonical_role_key_from_snapshot' in v_definition)=0 THEN
    RAISE EXCEPTION 'RPC must pin the exact rubric, role weight and historical role snapshot';
  END IF;
  IF position('RETURNING * INTO v_context' in v_definition)=0
    OR position('RETURN v_context' in v_definition)=0 THEN
    RAISE EXCEPTION 'RPC must return the committed canonical evaluation context';
  END IF;
END $$;

SELECT 'Evolution Phase 3.13 atomic context creation PostgreSQL PASS' AS result;
SQL
