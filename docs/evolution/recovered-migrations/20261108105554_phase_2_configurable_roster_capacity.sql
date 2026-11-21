alter table public.profiles drop constraint if exists profiles_player_number_check;
alter table public.profiles add constraint profiles_player_number_check check (player_number between 1 and 10);
alter table public.team_members drop constraint if exists team_members_player_number_check;
alter table public.team_members add constraint team_members_player_number_check check (player_number between 1 and 10);

create or replace function public.review_team_join_request(p_request uuid, p_player smallint, p_role text, p_approve boolean)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
 req public.team_join_requests%rowtype;
 n text;
 cap integer;
begin
 select * into req from public.team_join_requests where id=p_request for update;
 if req.id is null or not public.is_team_owner(req.team_id) then raise exception 'Not allowed'; end if;
 if req.status<>'pending' then raise exception 'Request already reviewed'; end if;
 if p_approve then
   select coalesce((setting_value #>> '{}')::integer,
     case when exists(select 1 from public.team_settings where team_id=req.team_id and setting_key='fifth_player' and setting_value='true'::jsonb) then 5 else 4 end)
   into cap from public.team_settings where team_id=req.team_id and setting_key='roster_capacity';
   if cap is null then
     select case when exists(select 1 from public.team_settings where team_id=req.team_id and setting_key='fifth_player' and setting_value='true'::jsonb) then 5 else 4 end into cap;
   end if;
   if cap<4 or cap>10 then raise exception 'Roster capacity must be between 4 and 10'; end if;
   if p_player not between 1 and cap then raise exception 'Choose a player slot within the configured roster capacity'; end if;
   if exists(select 1 from public.team_members where team_id=req.team_id and player_number=p_player and status='active' and user_id<>req.user_id) then raise exception 'That player slot is already occupied'; end if;
   select coalesce(nullif(trim(display_name),''),'Player') into n from public.profiles where id=req.user_id;
   if exists(select 1 from public.team_members where team_id=req.team_id and status='active' and user_id<>req.user_id and lower(btrim(display_name))=lower(btrim(n))) then
     raise exception 'This IGN is already used in your team. Ask the player to choose another IGN.';
   end if;
   insert into public.team_members(team_id,user_id,display_name,player_number,assigned_role,membership_role,status)
   values(req.team_id,req.user_id,n,p_player,p_role,'player','active')
   on conflict(team_id,user_id) do update set display_name=excluded.display_name,player_number=excluded.player_number,assigned_role=excluded.assigned_role,status='active';
   update public.team_join_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),assigned_player_number=p_player,assigned_role=p_role where id=p_request;
 else
   update public.team_join_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where id=p_request;
 end if;
end;
$function$;
revoke all on function public.review_team_join_request(uuid,smallint,text,boolean) from public, anon;
grant execute on function public.review_team_join_request(uuid,smallint,text,boolean) to authenticated;