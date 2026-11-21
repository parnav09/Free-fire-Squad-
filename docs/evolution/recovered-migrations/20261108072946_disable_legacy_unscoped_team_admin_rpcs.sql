
revoke all on function public.get_team_backup() from public,anon,authenticated;
revoke all on function public.restore_team_backup(jsonb) from public,anon,authenticated;
revoke all on function public.leave_team(uuid) from public,anon,authenticated;
