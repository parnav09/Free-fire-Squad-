
revoke all on function public.request_join_team(text) from public, anon;
grant execute on function public.request_join_team(text) to authenticated;
revoke all on function public.review_team_join_request(uuid,smallint,text,boolean) from public, anon;
grant execute on function public.review_team_join_request(uuid,smallint,text,boolean) to authenticated;
