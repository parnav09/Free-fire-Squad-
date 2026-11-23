#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Rebuild the complete Phase 3 dependency chain in this disposable database.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-three-11-db.sh"

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_table record;
  v_policy_count integer;
  v_anon_policy_count integer;
  v_function record;
BEGIN
  -- The private helper namespace must not be discoverable by client roles.
  IF has_schema_privilege('anon','evolution_private','USAGE')
    OR has_schema_privilege('authenticated','evolution_private','USAGE') THEN
    RAISE EXCEPTION 'Client roles must not have USAGE on evolution_private';
  END IF;

  -- Every Phase 3-owned public table must be protected by RLS and have an
  -- explicit policy. A table with RLS enabled but no policy is deny-all;
  -- it is still flagged here so future additions cannot silently become
  -- inaccessible without an intentional exception.
  FOR v_table IN
    SELECT c.relname,c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname LIKE 'evolution_%'
  LOOP
    IF NOT v_table.relrowsecurity THEN
      RAISE EXCEPTION 'RLS is disabled on Phase 3 table %',v_table.relname;
    END IF;

    SELECT count(*) INTO v_policy_count
    FROM pg_policy p
    JOIN pg_class c ON c.oid=p.polrelid
    WHERE c.relname=v_table.relname;
    IF v_policy_count=0 THEN
      RAISE EXCEPTION 'No explicit RLS policy exists on Phase 3 table %',v_table.relname;
    END IF;

    SELECT count(*) INTO v_anon_policy_count
    FROM pg_policy p
    JOIN pg_class c ON c.oid=p.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname=v_table.relname
      -- PUBLIC (OID 0) policies also apply to anon, even when anon is not
      -- explicitly listed in polroles.
      AND (
        0 = ANY(p.polroles)
        OR EXISTS (
          SELECT 1 FROM pg_roles anon_role
          WHERE anon_role.rolname='anon'
            AND anon_role.oid = ANY(p.polroles)
        )
      );
    IF v_anon_policy_count>0 THEN
      RAISE EXCEPTION 'RLS policy grants anon or PUBLIC access on Phase 3 table %',v_table.relname;
    END IF;

    -- RLS does not replace SQL privileges. Ensure anon has no direct or
    -- inherited table privilege, including privileges granted to PUBLIC.
    IF has_table_privilege('anon',format('public.%I',v_table.relname),'SELECT')
      OR has_table_privilege('anon',format('public.%I',v_table.relname),'INSERT')
      OR has_table_privilege('anon',format('public.%I',v_table.relname),'UPDATE')
      OR has_table_privilege('anon',format('public.%I',v_table.relname),'DELETE')
      OR has_table_privilege('anon',format('public.%I',v_table.relname),'TRUNCATE')
      OR has_table_privilege('anon',format('public.%I',v_table.relname),'REFERENCES')
      OR has_table_privilege('anon',format('public.%I',v_table.relname),'TRIGGER') THEN
      RAISE EXCEPTION 'Anonymous role has direct SQL privileges on Phase 3 table %',v_table.relname;
    END IF;
  END LOOP;

  -- Views must execute with the caller's privileges so underlying RLS applies.
  FOR v_table IN
    SELECT c.relname,c.reloptions
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v'
      AND c.relname LIKE 'evolution_%'
  LOOP
    IF NOT ('security_invoker=true' = ANY(COALESCE(v_table.reloptions,ARRAY[]::text[]))) THEN
      RAISE EXCEPTION 'Evolution view % is missing security_invoker=true',v_table.relname;
    END IF;
    IF has_table_privilege('anon',format('public.%I',v_table.relname),'SELECT') THEN
      RAISE EXCEPTION 'Anonymous role can read Evolution view %',v_table.relname;
    END IF;
  END LOOP;

  -- SECURITY DEFINER routines in the Phase 3 namespaces must use a fixed
  -- empty search_path and must never be executable by anon.
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature,
           n.nspname,p.proname,p.proconfig,p.prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prosecdef
      AND ((n.nspname='evolution_private')
        OR (n.nspname='public' AND p.proname LIKE 'evolution_%')
        OR (n.nspname='public' AND p.proname IN (
          'transition_evolution_evidence_status',
          'find_evolution_evidence_duplicate_candidates',
          'calculate_evolution_evidence_coverage',
          'calculate_evolution_player_score_snapshot'
        )))
  LOOP
    IF NOT ('search_path=""' = ANY(COALESCE(v_function.proconfig,ARRAY[]::text[]))) THEN
      RAISE EXCEPTION 'SECURITY DEFINER function % has no pinned empty search_path',v_function.signature;
    END IF;
    IF has_function_privilege('anon',v_function.signature,'EXECUTE') THEN
      RAISE EXCEPTION 'Anonymous role can execute SECURITY DEFINER function %',v_function.signature;
    END IF;
    IF v_function.nspname='public'
      AND NOT has_function_privilege('authenticated',v_function.signature,'EXECUTE') THEN
      RAISE EXCEPTION 'Authenticated role lacks the explicit RPC grant for %',v_function.signature;
    END IF;
    IF v_function.nspname='evolution_private'
      AND has_function_privilege('authenticated',v_function.signature,'EXECUTE') THEN
      RAISE EXCEPTION 'Authenticated role can directly execute private helper %',v_function.signature;
    END IF;
  END LOOP;
END $$;

-- Anonymous users must not be named in any Phase 3 RLS policy. Confirm the
-- catalog result directly rather than relying only on source-text assertions.
SELECT 'Evolution Phase 3.12 security, RLS and permissions PostgreSQL PASS' AS result;
SQL
