create table if not exists public.team_join_requests (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 requested_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 assigned_player_number smallint,
 assigned_role text,
 unique(team_id,user_id)
);
alter table public.team_join_requests enable row level security;
drop policy if exists "join request own read" on public.team_join_requests;
create policy "join request own read" on public.team_join_requests for select to authenticated using(user_id=auth.uid() or public.is_team_owner(team_id));
create or replace function public.request_join_team(p_code text) returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid; me uuid;
begin
 if auth.uid() is null then raise exception 'Not signed in'; end if;
 select id into t from teams where invite_code=upper(trim(p_code));
 if t is null then raise exception 'Invalid join code'; end if;
 if exists(select 1 from team_members where team_id=t and user_id=auth.uid() and status='active') then raise exception 'Already a team member'; end if;
 insert into team_join_requests(team_id,user_id,status,requested_at) values(t,auth.uid(),'pending',now())
 on conflict(team_id,user_id) do update set status='pending',requested_at=now(),reviewed_by=null,reviewed_at=null;
 return t;
end $$;
create or replace function public.review_team_join_request(p_request uuid,p_player smallint,p_role text,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$
declare req public.team_join_requests%rowtype;
begin
 select * into req from team_join_requests where id=p_request for update;
 if req.id is null or not public.is_team_owner(req.team_id) then raise exception 'Not allowed'; end if;
 if req.status<>'pending' then raise exception 'Request already reviewed'; end if;
 if p_approve then
  if p_player not between 1 and 5 then raise exception 'Choose player slot 1–5'; end if;
  if exists(select 1 from team_members where team_id=req.team_id and player_number=p_player and status='active') then raise exception 'That player slot is already occupied'; end if;
  insert into team_members(team_id,user_id,player_number,assigned_role,membership_role,status)
   values(req.team_id,req.user_id,p_player,p_role,'player','active')
   on conflict(team_id,user_id) do update set player_number=excluded.player_number,assigned_role=excluded.assigned_role,status='active';
  update team_join_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),assigned_player_number=p_player,assigned_role=p_role where id=p_request;
 else
  update team_join_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now() where id=p_request;
 end if;
end $$;
grant execute on function public.request_join_team(text) to authenticated;
grant execute on function public.review_team_join_request(uuid,smallint,text,boolean) to authenticated;