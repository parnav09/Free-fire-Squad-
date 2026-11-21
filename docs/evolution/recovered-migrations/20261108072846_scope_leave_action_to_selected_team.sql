
do $$
declare d text;
begin
 d:=pg_get_functiondef('public.leave_team(uuid)'::regprocedure);
 d:=replace(d,'FUNCTION public.leave_team(p_new_owner uuid DEFAULT NULL::uuid)','FUNCTION public.leave_team_for_team(p_team_id uuid, p_new_owner uuid DEFAULT NULL::uuid)');
 d:=replace(d,'where tm.user_id=v_user and tm.status=''active'' limit 1 for update','where tm.user_id=v_user and tm.status=''active'' and tm.team_id=p_team_id limit 1 for update');
 execute d;
end $$;
revoke all on function public.leave_team_for_team(uuid,uuid) from public,anon;
grant execute on function public.leave_team_for_team(uuid,uuid) to authenticated;
