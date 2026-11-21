
-- Team names are labels, not identifiers. teams.id remains the immutable tenant key.
-- Player IGN belongs to a membership, not globally to an auth profile.
alter table public.team_members add column if not exists display_name text;

update public.team_members tm
set display_name = coalesce(nullif(trim(p.display_name),''),'Player')
from public.profiles p
where p.id=tm.user_id and (tm.display_name is null or btrim(tm.display_name)='');

drop index if exists public.profiles_display_name_lower_uidx;

create unique index if not exists team_members_team_display_name_lower_uidx
on public.team_members(team_id, lower(btrim(display_name)))
where status='active' and display_name is not null and btrim(display_name)<>'';

create or replace function public.set_display_name(p_name text, p_team_id uuid default null)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
 n text:=trim(p_name);
 v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Not signed in'; end if;
 if char_length(n)<2 or char_length(n)>40 then raise exception 'IGN must be 2 to 40 characters'; end if;
 if p_team_id is null then
   -- On onboarding, save a default profile label. No global uniqueness rule.
   update public.profiles set display_name=n where id=v_user;
 else
   if not exists(select 1 from public.team_members where team_id=p_team_id and user_id=v_user and status='active') then
     raise exception 'You are not an active member of this team';
   end if;
   if exists(select 1 from public.team_members where team_id=p_team_id and user_id<>v_user and status='active' and lower(btrim(display_name))=lower(btrim(n))) then
     raise exception 'This IGN is already used by another player in this team';
   end if;
   update public.team_members set display_name=n where team_id=p_team_id and user_id=v_user;
 end if;
end;
$$;

create or replace function public.create_team(p_name text, p_description text, p_timezone text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
 t uuid;
 n text;
begin
 if auth.uid() is null then raise exception 'Not signed in'; end if;
 if char_length(trim(p_name))<2 or char_length(trim(p_name))>48 then raise exception 'Team name must be 2 to 48 characters'; end if;
 select coalesce(nullif(trim(display_name),''),'Squad Player') into n from public.profiles where id=auth.uid();
 insert into public.teams(team_name,team_description,owner_id,timezone)
 values(trim(p_name),nullif(trim(p_description),''),auth.uid(),coalesce(nullif(trim(p_timezone),''),'UTC'))
 returning id into t;
 insert into public.team_members(team_id,user_id,display_name,membership_role,status)
 values(t,auth.uid(),n,'owner','active');
 return t;
end;
$$;

create or replace function public.review_team_join_request(p_request uuid,p_player smallint,p_role text,p_approve boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
 req public.team_join_requests%rowtype;
 n text;
begin
 select * into req from public.team_join_requests where id=p_request for update;
 if req.id is null or not public.is_team_owner(req.team_id) then raise exception 'Not allowed'; end if;
 if req.status<>'pending' then raise exception 'Request already reviewed'; end if;
 if p_approve then
   if p_player not between 1 and 5 then raise exception 'Choose player slot 1–5'; end if;
   if p_player=5 and not exists(select 1 from public.team_settings where team_id=req.team_id and setting_key='fifth_player' and setting_value='true'::jsonb) then raise exception 'Fifth player is not enabled in Team Settings'; end if;
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
$$;

revoke all on function public.set_display_name(text,uuid) from public,anon;
grant execute on function public.set_display_name(text,uuid) to authenticated;
revoke all on function public.create_team(text,text,text) from public,anon;
grant execute on function public.create_team(text,text,text) to authenticated;
revoke all on function public.review_team_join_request(uuid,smallint,text,boolean) from public,anon;
grant execute on function public.review_team_join_request(uuid,smallint,text,boolean) to authenticated;
