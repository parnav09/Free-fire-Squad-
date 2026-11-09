create table if not exists public.training_session_participants (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
 session_id uuid not null references public.training_sessions(id) on delete cascade,
 player_member_id uuid not null references public.team_members(id) on delete cascade,
 attendance text not null default 'pending' check(attendance in ('pending','present','absent','excused')),
 participation_notes text not null default '', created_at timestamptz not null default now(),
 unique(session_id,player_member_id)
);
create index if not exists training_session_participants_session_idx on public.training_session_participants(session_id,attendance);
alter table public.training_session_participants enable row level security;
drop policy if exists squad_team_read on public.training_session_participants;
create policy squad_team_read on public.training_session_participants for select to authenticated using (exists(select 1 from public.team_members tm where tm.team_id=training_session_participants.team_id and tm.user_id=auth.uid() and tm.status='active'));
drop policy if exists squad_staff_write on public.training_session_participants;
create policy squad_staff_write on public.training_session_participants for all to authenticated using (exists(select 1 from public.team_members tm where tm.team_id=training_session_participants.team_id and tm.user_id=auth.uid() and tm.status='active' and tm.membership_role in ('owner','coach'))) with check (exists(select 1 from public.team_members tm where tm.team_id=training_session_participants.team_id and tm.user_id=auth.uid() and tm.status='active' and tm.membership_role in ('owner','coach')));
grant select,insert,update,delete on public.training_session_participants to authenticated;