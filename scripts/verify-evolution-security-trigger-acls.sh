#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to the disposable CI PostgreSQL service}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACL_SQL="$ROOT/docs/evolution/staged-migrations/20261118080000_revoke_direct_trigger_function_execution.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_practice_task_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.set_practice_task_lifecycle_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.track_practice_task_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN NEW; END; $$;

GRANT EXECUTE ON FUNCTION public.lock_daily_score_date_and_anonymize() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_practice_task_lifecycle() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_practice_task_lifecycle_fields() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.track_practice_task_lifecycle() TO anon, authenticated, service_role;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ACL_SQL"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  fn regprocedure;
  role_name text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.lock_daily_score_date_and_anonymize()'::regprocedure,
    'public.log_practice_task_lifecycle()'::regprocedure,
    'public.set_practice_task_lifecycle_fields()'::regprocedure,
    'public.track_practice_task_lifecycle()'::regprocedure
  ] LOOP
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION '% still has EXECUTE on %', role_name, fn;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT ON public.daily_scores TO authenticated;
SET ROLE authenticated;
INSERT INTO public.daily_scores (score_date, evaluator_id, notes, improvement_target, review_visibility)
VALUES (DATE '2000-01-01', '00000000-0000-0000-0000-000000000001', 'must be cleared', 'must be cleared', 'public');
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.daily_scores
    WHERE score_date = (now() AT TIME ZONE 'Asia/Kolkata')::date
      AND evaluator_id IS NULL
      AND notes IS NULL
      AND improvement_target IS NULL
      AND review_visibility = 'recipient_only'
  ) THEN
    RAISE EXCEPTION 'Daily Evaluation trigger stopped working after EXECUTE revocation';
  END IF;
END;
$$;
SQL

echo "Security ACL contract PASS: API roles cannot call trigger functions directly; existing Daily Evaluation trigger still executes."
