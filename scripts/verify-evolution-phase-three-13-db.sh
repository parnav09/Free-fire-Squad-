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

# Exercise the RPC as an authenticated owner against the Phase 3.10 canonical
# match/rubric/weight fixture. Then prove an invalid historical role cannot
# leave an orphan context behind.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000007',false);

DO $$
DECLARE
  v_source public.evolution_evaluation_contexts%ROWTYPE;
  v_created public.evolution_evaluation_contexts%ROWTYPE;
  v_before integer;
  v_after integer;
  v_rubric_bindings integer;
  v_weight_bindings integer;
  v_sniper_role uuid;
  v_sniper_member uuid;
  v_sniper_user uuid;
  v_sniper_session uuid;
  v_sniper_match uuid;
BEGIN
  SELECT c.* INTO v_source
  FROM public.evolution_evaluation_contexts c
  JOIN public.canonical_session_match_roles r
    ON r.id=c.role_assignment_id
   AND r.team_id=c.team_id
   AND r.role_assignment_status='assigned'
  WHERE c.team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND c.created_by='70000000-0000-0000-0000-000000000007'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Phase 3.13 requires the canonical Phase 3.10 active evaluation fixture';
  END IF;

  SELECT count(*) INTO v_before
  FROM public.evolution_evaluation_contexts
  WHERE team_id=v_source.team_id;

  v_created := public.create_evolution_evaluation_context(
    v_source.team_id,
    v_source.player_member_id,
    v_source.player_user_id,
    v_source.canonical_session_id,
    v_source.canonical_session_match_id,
    v_source.role_assignment_id
  );

  IF v_created.id IS NULL
    OR v_created.id=v_source.id
    OR v_created.created_by IS DISTINCT FROM auth.uid()
    OR v_created.role_assignment_id IS DISTINCT FROM v_source.role_assignment_id THEN
    RAISE EXCEPTION 'Atomic evaluation context RPC returned an invalid context';
  END IF;

  SELECT count(*) INTO v_rubric_bindings
  FROM public.evolution_evaluation_rubric_bindings
  WHERE evaluation_context_id=v_created.id AND team_id=v_created.team_id;
  SELECT count(*) INTO v_weight_bindings
  FROM public.evolution_evaluation_role_weight_bindings
  WHERE evaluation_context_id=v_created.id AND team_id=v_created.team_id;

  IF v_rubric_bindings<>1 OR v_weight_bindings<>1 THEN
    RAISE EXCEPTION 'Atomic context creation must persist exactly one rubric and role-weight binding';
  END IF;

  SELECT count(*) INTO v_before
  FROM public.evolution_evaluation_contexts
  WHERE team_id=v_source.team_id;

  BEGIN
    PERFORM public.create_evolution_evaluation_context(
      v_source.team_id,
      v_source.player_member_id,
      v_source.player_user_id,
      v_source.canonical_session_id,
      v_source.canonical_session_match_id,
      'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
    );
    RAISE EXCEPTION 'Invalid role snapshot unexpectedly created an evaluation context';
  EXCEPTION WHEN SQLSTATE '23514' THEN
    NULL;
  END;

  SELECT count(*) INTO v_after
  FROM public.evolution_evaluation_contexts
  WHERE team_id=v_source.team_id;

  IF v_after<>v_before THEN
    RAISE EXCEPTION 'Failed atomic context creation left an orphan evaluation context';
  END IF;

  -- This fixture has an assigned Sniper + IGL role but only a Primary Rusher
  -- weight set. The RPC must fail after the context insert and roll it back.
  SELECT r.id,tm.id,r.player_user_id,r.canonical_session_id,r.canonical_session_match_id
    INTO v_sniper_role,v_sniper_member,v_sniper_user,v_sniper_session,v_sniper_match
  FROM public.canonical_session_match_roles r
  JOIN public.team_members tm
    ON tm.team_id=r.team_id AND tm.user_id=r.player_user_id AND tm.status='active'
  WHERE r.team_id=v_source.team_id
    AND r.role_assignment_status='assigned'
    AND lower(btrim(r.role_key_snapshot)) IN ('sniper + igl','sniper igl','sniper-igl','sniper_igl')
  ORDER BY r.changed_at,r.id
  LIMIT 1;

  IF v_sniper_role IS NULL THEN
    RAISE EXCEPTION 'Phase 3.13 rollback fixture requires an assigned Sniper + IGL snapshot';
  END IF;

  SELECT count(*) INTO v_before
  FROM public.evolution_evaluation_contexts
  WHERE team_id=v_source.team_id;

  BEGIN
    PERFORM public.create_evolution_evaluation_context(
      v_source.team_id,v_sniper_member,v_sniper_user,
      v_sniper_session,v_sniper_match,v_sniper_role
    );
    RAISE EXCEPTION 'Missing historical role weights unexpectedly created an evaluation context';
  EXCEPTION WHEN SQLSTATE '23514' THEN
    NULL;
  END;

  SELECT count(*) INTO v_after
  FROM public.evolution_evaluation_contexts
  WHERE team_id=v_source.team_id;

  IF v_after<>v_before THEN
    RAISE EXCEPTION 'Missing role-weight configuration left an orphan evaluation context';
  END IF;
END $;

RESET ROLE;
SELECT 'Evolution Phase 3.13 atomic context creation behavior PASS' AS result;
SQL
