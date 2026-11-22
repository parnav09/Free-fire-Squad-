#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122210000_evolution_phase_three_11_atomic_scoring_integrity.sql"
TMP_LOG="$(mktemp)"
HOLDER_PID=""
cleanup() {
  if [[ -n "$HOLDER_PID" ]]; then kill "$HOLDER_PID" 2>/dev/null || true; fi
  rm -f "$TMP_LOG"
}
trap cleanup EXIT

# Rebuild all required isolated schema/fixtures and verify Phase 3.10 first.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-three-10-db.sh"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_table text;
  v_trigger text;
  v_context uuid;
  v_lock_def text;
  v_rpc_def text;
  v_index boolean;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'evolution_evidence_items',
    'evolution_evidence_versions',
    'evolution_evidence_verification_events',
    'evolution_evaluation_dimension_assessment_events'
  ] LOOP
    SELECT t.tgname INTO v_trigger
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=v_table
      AND NOT t.tgisinternal
      AND t.tgenabled IN ('O','A')
      AND t.tgfoid IN (
        'evolution_private.lock_evidence_context_for_scoring_write()'::regprocedure,
        'evolution_private.lock_assessment_context_for_scoring_write()'::regprocedure
      );
    IF v_trigger IS NULL THEN
      RAISE EXCEPTION 'Scoring serialization trigger missing or disabled on %',v_table;
    END IF;
  END LOOP;

  SELECT pg_get_functiondef(
    'evolution_private.lock_evaluation_context_for_scoring(uuid)'::regprocedure
  ) INTO v_lock_def;
  IF v_lock_def NOT LIKE '%hashtextextended(p_evaluation_context_id::text, 31010)%'
    OR has_function_privilege('authenticated',
      'evolution_private.lock_evaluation_context_for_scoring(uuid)','EXECUTE')
    OR has_function_privilege('anon',
      'evolution_private.lock_evaluation_context_for_scoring(uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Shared scoring lock key or helper ACL is invalid'; END IF;

  SELECT pg_get_functiondef(
    'public.calculate_evolution_player_score_snapshot(uuid,text)'::regprocedure
  ) INTO v_rpc_def;
  IF v_rpc_def NOT LIKE '%lock_evaluation_context_for_scoring%'
    OR NOT has_function_privilege('authenticated',
      'public.calculate_evolution_player_score_snapshot(uuid,text)','EXECUTE')
    OR has_function_privilege('anon',
      'public.calculate_evolution_player_score_snapshot(uuid,text)','EXECUTE')
  THEN RAISE EXCEPTION 'Scoring RPC does not use the shared lock or has invalid ACL'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid=i.indexrelid
    WHERE c.relname='evolution_score_snapshot_single_child_uidx'
      AND i.indisunique AND i.indisvalid
  ) INTO v_index;
  IF NOT v_index THEN RAISE EXCEPTION 'Single-child snapshot history guard missing'; END IF;

  SELECT id INTO v_context
  FROM public.evolution_evaluation_contexts
  ORDER BY created_at DESC LIMIT 1;
  IF v_context IS NULL THEN RAISE EXCEPTION 'No disposable evaluation context fixture exists'; END IF;
  PERFORM set_config('phase_311.test_context',v_context::text,false);
END $$;
SQL

CONTEXT_ID="$(psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 -c "SELECT current_setting('phase_311.test_context',true)")"
if [[ -z "$CONTEXT_ID" ]]; then
  CONTEXT_ID="$(psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 -c "SELECT id FROM public.evolution_evaluation_contexts ORDER BY created_at DESC LIMIT 1")"
fi

# Prove the transaction-scoped context lock excludes a concurrent scorer/input
# writer, and is released automatically at transaction end.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "BEGIN; SELECT evolution_private.lock_evaluation_context_for_scoring('$CONTEXT_ID'::uuid); SELECT pg_sleep(2); COMMIT" >"$TMP_LOG" 2>&1 &
HOLDER_PID=$!
LOCKED=false
for _ in $(seq 1 30); do
  TRY_RESULT="$(psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 -c "SELECT pg_try_advisory_xact_lock(hashtextextended('$CONTEXT_ID'::text,31010))")"
  if [[ "$TRY_RESULT" == "f" ]]; then LOCKED=true; break; fi
  sleep 0.1
done
if [[ "$LOCKED" != "true" ]]; then
  cat "$TMP_LOG"
  echo "Phase 3.11 concurrent scoring lock was not acquired by holder" >&2
  exit 1
fi
wait "$HOLDER_PID"
HOLDER_PID=""
AFTER_RELEASE="$(psql "$DATABASE_URL" -X -Atq -v ON_ERROR_STOP=1 -c "SELECT pg_try_advisory_xact_lock(hashtextextended('$CONTEXT_ID'::text,31010))")"
if [[ "$AFTER_RELEASE" != "t" ]]; then
  echo "Phase 3.11 transaction lock was not released at commit" >&2
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "SELECT 'Evolution Phase 3.11 atomic scoring and database integrity PostgreSQL PASS' AS result"
