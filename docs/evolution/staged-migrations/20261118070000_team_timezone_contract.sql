-- Evolution Phase One.5-B: preserve the existing persisted-date contract and
-- validate configured team timezone values at the database boundary.
-- STAGED ONLY: do not move into supabase/migrations or apply until isolated
-- PostgreSQL/Supabase validation is complete.
--
-- IMPORTANT: daily_scores.score_date remains Asia/Kolkata. The existing
-- daily_scores_lock_date_anonymous trigger and ds_insert policy are
-- intentionally unchanged. This migration does not convert historical rows,
-- add a second daily_scores trigger, or change date boundaries.

CREATE OR REPLACE FUNCTION public.validate_team_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.timezone IS NULL OR btrim(NEW.timezone) = '' THEN
    RAISE EXCEPTION 'Team timezone must be a recognized IANA timezone';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names AS tz
    WHERE tz.name = NEW.timezone
  ) THEN
    RAISE EXCEPTION 'Unrecognized team timezone: %', NEW.timezone;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS teams_validate_timezone ON public.teams;
CREATE TRIGGER teams_validate_timezone
BEFORE INSERT OR UPDATE OF timezone ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.validate_team_timezone();

-- Deliberately do not alter public.lock_daily_score_date_and_anonymize(),
-- daily_scores triggers, or ds_insert. They remain the source of truth for
-- Asia/Kolkata persisted dates until a separately approved timezone change.
