-- Evolution Phase One.5-B: team-local persisted date contract.
-- STAGED ONLY: do not move into supabase/migrations or apply until isolated
-- PostgreSQL/Supabase validation and the migration-chain gate are complete.
-- This migration deliberately preserves the existing anonymization trigger.
-- The new date trigger sorts after daily_scores_lock_date_anonymous by name.

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

CREATE OR REPLACE FUNCTION public.set_daily_score_team_local_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_timezone text;
BEGIN
  SELECT t.timezone
    INTO v_timezone
    FROM public.teams AS t
   WHERE t.id = NEW.team_id;

  IF v_timezone IS NULL OR btrim(v_timezone) = '' THEN
    RAISE EXCEPTION 'A valid team timezone is required to save a Daily Evaluation';
  END IF;

  NEW.score_date := (now() AT TIME ZONE v_timezone)::date;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_daily_scores_team_timezone_date ON public.daily_scores;
CREATE TRIGGER trg_daily_scores_team_timezone_date
BEFORE INSERT ON public.daily_scores
FOR EACH ROW
EXECUTE FUNCTION public.set_daily_score_team_local_date();

-- Keep the existing evaluator-null and can_rate checks. Only replace the
-- hard-coded timezone expression with the selected team's configured zone.
ALTER POLICY ds_insert ON public.daily_scores
WITH CHECK (
  evaluator_id IS NULL
  AND can_rate(team_id, player_id)
  AND score_date = (
    (now() AT TIME ZONE (
      SELECT t.timezone
      FROM public.teams AS t
      WHERE t.id = daily_scores.team_id
    ))::date
  )
);
