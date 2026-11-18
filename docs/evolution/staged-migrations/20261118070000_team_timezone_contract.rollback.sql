-- Rollback for the staged Evolution Phase One.5-B timezone contract.
-- Restores the exact pre-migration ds_insert date predicate and removes only
-- objects introduced by 20261118070000_team_timezone_contract.sql.
-- No historical Daily Evaluation rows are rewritten.

ALTER POLICY ds_insert ON public.daily_scores
WITH CHECK (
  evaluator_id IS NULL
  AND can_rate(team_id, player_id)
  AND score_date = ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date
);

DROP TRIGGER IF EXISTS trg_daily_scores_team_timezone_date ON public.daily_scores;
DROP FUNCTION IF EXISTS public.set_daily_score_team_local_date();

DROP TRIGGER IF EXISTS teams_validate_timezone ON public.teams;
DROP FUNCTION IF EXISTS public.validate_team_timezone();
