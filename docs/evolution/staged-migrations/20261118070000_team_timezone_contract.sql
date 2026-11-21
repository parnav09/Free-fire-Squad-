-- Evolution Phase One.5-B: India-only date and timezone contract.
-- STAGED ONLY: validate on an isolated PostgreSQL/Supabase branch before
-- moving into supabase/migrations. Do not apply directly to production.
--
-- The app uses India Standard Time only (Asia/Kolkata, UTC+05:30).
-- Asia/Calcutta is normalized as a legacy alias; the old UTC column default
-- is normalized on INSERT so all persisted team rows use Asia/Kolkata.
-- Daily Evaluation trigger/RLS and all historical score rows remain untouched.

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

CREATE OR REPLACE FUNCTION public.validate_team_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.timezone IS NULL OR btrim(NEW.timezone) = '' THEN
    RAISE EXCEPTION 'Squad OS supports India Standard Time only';
  END IF;

  IF NEW.timezone IN ('UTC', 'Asia/Calcutta') THEN
    NEW.timezone := 'Asia/Kolkata';
  ELSIF NEW.timezone <> 'Asia/Kolkata' THEN
    RAISE EXCEPTION 'Unsupported team timezone: %. Squad OS uses Asia/Kolkata only', NEW.timezone;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS teams_validate_timezone ON public.teams;
CREATE TRIGGER teams_validate_timezone
BEFORE INSERT OR UPDATE OF timezone ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.validate_team_timezone();

-- Normalize the one legacy alias without changing any evaluation dates.
UPDATE public.teams
SET timezone = 'Asia/Kolkata'
WHERE timezone = 'Asia/Calcutta';

-- Team Join inherits the selected team's canonical Asia/Kolkata timezone.
-- Members do not select device-local or international timezones.
