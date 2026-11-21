create or replace function public.review_team_join_request(p_request uuid,p_player smallint,p_role text,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$
declare req public.team_join_requests%rowtype;
begin
 select * into req from team_join_requests where id=p_request for update;
 if req.id is null or not public.is_team_owner(req.team_id) then raise exception 'Not allowed'; end if;
 if req.status<>'pending' then raise exception 'Request already reviewed'; end if;
 if p_approve then
  if p_player not between 1 and 5 then raise exception 'Choose player slot 1–5'; end if;
  if p_player=5 and not exists(select 1 from team_settings where team_id=req.team_id and setting_key='fifth_player' and setting_value='true'::jsonb) then raise exception 'Fifth player is not enabled in Team Settings'; end if;
  if exists(select 1 from team_members where team_id=req.team_id and player_number=p_player and status='active') then raise exception 'That player slot is already occupied'; end if;
  insert into team_members(team_id,user_id,player_number,assigned_role,membership_role,status) values(req.team_id,req.user_id,p_player,p_role,'player','active') on conflict(team_id,user_id) do update set player_number=excluded.player_number,assigned_role=excluded.assigned_role,status='active';
  update team_join_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),assigned_player_number=p_player,assigned_role=p_role where id=p_request;
 else update team_join_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where id=p_request;
 end if;
end $$;
grant execute on function public.review_team_join_request(uuid,smallint,text,boolean) to authenticated;