#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to the disposable CI PostgreSQL service}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORWARD="$ROOT/docs/evolution/staged-migrations/20261118070000_team_timezone_contract.sql"
ROLLBACK="$ROOT/docs/evolution/staged-migrations/20261118070000_team_timezone_contract.rollback.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.teams (
  id uuid PRIMARY KEY,
  timezone text NOT NULL DEFAULT 'UTC'
);

INSERT INTO public.teams (id, timezone)
VALUES ('00000000-0000-0000-0000-000000000001', 'Asia/Calcutta');

CREATE TABLE public.daily_scores (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  score_date date,
  evaluator_id uuid,
  notes text,
  improvement_target text,
  review_visibility text
);

CREATE OR REPLACE FUNCTION public.lock_daily_score_date_and_anonymize()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.score_date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  NEW.evaluator_id := NULL;
  NEW.notes := NULL;
  NEW.improvement_target := NULL;
  NEW.review_visibility := 'recipient_only';
  RETURN NEW;
END;
$$;

CREATE TRIGGER daily_scores_lock_date_anonymous
BEFORE INSERT OR UPDATE ON public.daily_scores
FOR EACH ROW
EXECUTE FUNCTION public.lock_daily_score_date_and_anonymize();

ALTER TABLE public.daily_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY ds_insert ON public.daily_scores
FOR INSERT WITH CHECK (true);
SQL

# Apply the exact staged forward SQL to a disposable PostgreSQL instance.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$FORWARD"

# The database trigger must normalize the physical UTC default and legacy alias.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public.teams (id)
VALUES ('00000000-0000-0000-0000-000000000002');

INSERT INTO public.teams (id, timezone)
VALUES ('00000000-0000-0000-0000-000000000003', 'Asia/Calcutta');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.teams WHERE timezone = 'Asia/Kolkata') <> 3 THEN
    RAISE EXCEPTION 'default/legacy timezone normalization failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'teams_validate_timezone'
      AND tgrelid = 'public.teams'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'timezone validation trigger was not installed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'daily_scores_lock_date_anonymous'
      AND tgrelid = 'public.daily_scores'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'existing Daily Evaluation trigger was changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_scores'
      AND policyname = 'ds_insert'
  ) THEN
    RAISE EXCEPTION 'existing Daily Evaluation RLS policy was changed';
  END IF;

  IF (SELECT timezone FROM public.teams
      WHERE id = '00000000-0000-0000-0000-000000000003') <> 'Asia/Kolkata' THEN
    RAISE EXCEPTION 'team-join inheritance lookup did not return canonical timezone';
  END IF;
END;
$$;
SQL

# Invalid zones and blank values must fail; a successful INSERT is a test failure.
if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO public.teams (id, timezone) VALUES ('00000000-0000-0000-0000-000000000004', 'America/New_York');" >/dev/null 2>&1; then
  echo "ERROR: non-India timezone was accepted" >&2
  exit 1
fi

if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO public.teams (id, timezone) VALUES ('00000000-0000-0000-0000-000000000005', '   ');" >/dev/null 2>&1; then
  echo "ERROR: blank timezone was accepted" >&2
  exit 1
fi

# Restore-path writes are guarded by the same row trigger.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "UPDATE public.teams SET timezone = 'UTC' WHERE id = '00000000-0000-0000-0000-000000000001';"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF (SELECT timezone FROM public.teams WHERE id = '00000000-0000-0000-0000-000000000001') <> 'Asia/Kolkata' THEN RAISE EXCEPTION 'restore-path normalization failed'; END IF; END \$\$;"

# Execute the exact staged rollback and verify it removes only its own objects.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROLLBACK"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'teams_validate_timezone'
      AND tgrelid = 'public.teams'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'rollback left the timezone trigger installed';
  END IF;

  IF to_regprocedure('public.validate_team_timezone()') IS NOT NULL THEN
    RAISE EXCEPTION 'rollback left the timezone function installed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'daily_scores_lock_date_anonymous'
      AND tgrelid = 'public.daily_scores'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'rollback removed the existing Daily Evaluation trigger';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_scores'
      AND policyname = 'ds_insert'
  ) THEN
    RAISE EXCEPTION 'rollback removed the existing Daily Evaluation policy';
  END IF;
END;
$$;
SQL

echo "B database contract PASS: forward, normalization, rejection, restore-path, existing trigger/RLS preservation, rollback."
