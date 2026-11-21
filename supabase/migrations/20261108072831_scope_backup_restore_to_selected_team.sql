
do $$
declare d text;
begin
 d:=pg_get_functiondef('public.get_team_backup()'::regprocedure);
 d:=replace(d,'FUNCTION public.get_team_backup()','FUNCTION public.get_team_backup_for_team(p_team_id uuid)');
 d:=replace(d,'where t.owner_id=v_user and tm.user_id=v_user and tm.status=''active''','where t.owner_id=v_user and tm.user_id=v_user and tm.status=''active'' and t.id=p_team_id');
 execute d;

 d:=pg_get_functiondef('public.restore_team_backup(jsonb)'::regprocedure);
 d:=replace(d,'FUNCTION public.restore_team_backup(p_backup jsonb)','FUNCTION public.restore_team_backup_for_team(p_backup jsonb, p_team_id uuid)');
 d:=replace(d,'where t.owner_id=v_user and tm.user_id=v_user and tm.status=''active''','where t.owner_id=v_user and tm.user_id=v_user and tm.status=''active'' and t.id=p_team_id');
 execute d;
end $$;
revoke all on function public.get_team_backup_for_team(uuid) from public,anon;
grant execute on function public.get_team_backup_for_team(uuid) to authenticated;
revoke all on function public.restore_team_backup_for_team(jsonb,uuid) from public,anon;
grant execute on function public.restore_team_backup_for_team(jsonb,uuid) to authenticated;
