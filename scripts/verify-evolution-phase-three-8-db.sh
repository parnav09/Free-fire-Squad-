#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122190000_evolution_phase_three_8_evidence_coverage_calculator.sql"
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-three-7-db.sh"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000007',false);
DO $$
DECLARE
  v_context uuid;
  v_snapshot uuid;
  v_repeat uuid;
  v_count integer;
  v_observed integer;
  v_verified integer;
  v_unverified integer;
  v_percent numeric(5,2);
  v_status text;
BEGIN
  SELECT evaluation_context_id INTO v_context
  FROM public.evolution_evaluation_role_weight_bindings wb
  JOIN public.evolution_role_weight_sets ws ON ws.id=wb.weight_set_id
  WHERE ws.lifecycle_status='active'
  ORDER BY wb.bound_at DESC LIMIT 1;
  IF v_context IS NULL THEN RAISE EXCEPTION 'Phase 3.7 fixture context missing'; END IF;

  v_snapshot := public.calculate_evolution_evidence_coverage(v_context);
  v_repeat := public.calculate_evolution_evidence_coverage(v_context);
  IF v_snapshot IS NULL OR v_snapshot IS DISTINCT FROM v_repeat THEN
    RAISE EXCEPTION 'Identical coverage inputs must return the same idempotent snapshot';
  END IF;

  SELECT applicable_dimension_count,observed_dimension_count,
    verified_evidence_dimension_count,unverified_evidence_dimension_count,
    coverage_percent,coverage_status
  INTO v_count,v_observed,v_verified,v_unverified,v_percent,v_status
  FROM public.evolution_evidence_coverage_snapshots WHERE id=v_snapshot;
  IF v_count < 2 OR v_observed <> 1 OR v_verified <> 1 OR v_unverified <> 0
    OR v_percent IS DISTINCT FROM round(10000::numeric / v_count)::numeric / 100
    OR v_status <> 'partial' THEN
    RAISE EXCEPTION 'Coverage snapshot counts/status mismatch: %, %, %, %, %, %',
      v_count,v_observed,v_verified,v_unverified,v_percent,v_status;
  END IF;

  BEGIN
    UPDATE public.evolution_evidence_coverage_snapshots SET coverage_percent=0 WHERE id=v_snapshot;
    RAISE EXCEPTION 'Coverage snapshot update unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    DELETE FROM public.evolution_evidence_coverage_snapshots WHERE id=v_snapshot;
    RAISE EXCEPTION 'Coverage snapshot delete unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '55000' THEN NULL;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.evolution_evidence_coverage_snapshots','INSERT')
    OR has_table_privilege('authenticated','public.evolution_evidence_coverage_snapshots','UPDATE')
    OR has_table_privilege('authenticated','public.evolution_evidence_coverage_snapshots','DELETE')
    OR has_table_privilege('anon','public.evolution_evidence_coverage_snapshots','SELECT')
  THEN RAISE EXCEPTION 'Evidence coverage snapshot ACLs are too permissive'; END IF;
END $$;
SELECT 'Evolution Phase 3.8 evidence coverage calculator PostgreSQL PASS' AS result;
SQL
