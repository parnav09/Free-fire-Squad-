ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog;
ALTER FUNCTION public.fix_role() SET search_path = pg_catalog;

DROP POLICY IF EXISTS ds_select ON public.daily_scores;
CREATE POLICY ds_select ON public.daily_scores FOR SELECT TO authenticated USING (public.is_team_member(team_id));

DROP POLICY IF EXISTS tr_select ON public.team_ratings;
CREATE POLICY tr_select ON public.team_ratings FOR SELECT TO authenticated USING (public.is_team_member(team_id));

REVOKE EXECUTE ON FUNCTION public.can_rate(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_team_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mirror_profile() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shares_team_with(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.can_rate(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_team_with(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_daily_drills_player ON public.daily_drills(player_id);
CREATE INDEX IF NOT EXISTS idx_daily_drills_evaluator ON public.daily_drills(evaluator);
CREATE INDEX IF NOT EXISTS idx_daily_scores_evaluator ON public.daily_scores(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_team_ratings_evaluator ON public.team_ratings(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_player_nicknames_team ON public.player_nicknames(team_id);
CREATE INDEX IF NOT EXISTS idx_player_nicknames_target ON public.player_nicknames(target_id);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_training_log_updated_by ON public.training_log(updated_by);