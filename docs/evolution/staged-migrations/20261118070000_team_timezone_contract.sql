-- Evolution Phase One.5-B: India-only date and timezone contract.
-- STAGED ONLY: validate on an isolated PostgreSQL/Supabase branch before
-- moving into supabase/migrations. Do not apply directly to production.
--
-- The app uses India Standard Time only (Asia/Kolkata, UTC+05:30).
-- Asia/Calcutta is accepted solely as a legacy alias for existing teams.
-- Daily Evaluation remains keyed to the existing Asia/Kolkata trigger/RLS
-- contract. No daily_scores trigger, policy, or historical row is changed.

ALTER TABLE public.teams
  ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.teams
    WHERE timezone NOT IN ('Asia/Kolkata', 'Asia/Calcutta')
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce India-only timezone contract: unsupported team timezone values exist';
  END IF;
END;
$migration$;

ALTER TABLE public.teams
  ADD CONSTRAINT teams_timezone_india_only
  CHECK (timezone IN ('Asia/Kolkata', 'Asia/Calcutta')) NOT VALID;

ALTER TABLE public.teams
  VALIDATE CONSTRAINT teams_timezone_india_only;

-- Team Join inherits the selected team's timezone; members cannot select
-- a device-local or international timezone. The alias has the same IST rules.
