
create table if not exists public.tournament_cycles (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 cycle_start date not null,
 cycle_end date not null,
 title text not null default 'Weekly Tournament',
 registration_open_at timestamptz,
 registration_close_at timestamptz,
 status text not null default 'draft' check (status in ('draft','registration','active','completed','archived')),
 roster_snapshot jsonb not null default '[]'::jsonb,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(team_id,cycle_start),
 check(cycle_end >= cycle_start)
);
create table if not exists public.tournament_matches (
 id uuid primary key default gen_random_uuid(),
 cycle_id uuid not null references public.tournament_cycles(id) on delete cascade,
 team_id uuid not null references public.teams(id) on delete cascade,
 match_day smallint not null check(match_day between 1 and 7),
 match_number smallint not null check(match_number between 1 and 6),
 map_name text,
 drop_location text,
 placement smallint check(placement between 1 and 12),
 kills smallint not null default 0 check(kills >= 0),
 points smallint not null default 0 check(points >= 0),
 status text not null default 'scheduled' check(status in ('scheduled','draft','submitted','verified','disputed')),
 notes text check(char_length(notes) <= 1000),
 recorded_by uuid references auth.users(id),
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(cycle_id,match_day,match_number)
);
create index if not exists tournament_cycles_team_start_idx on public.tournament_cycles(team_id,cycle_start desc);
create index if not exists tournament_matches_cycle_day_idx on public.tournament_matches(cycle_id,match_day,match_number);
create index if not exists tournament_matches_team_status_idx on public.tournament_matches(team_id,status);
alter table public.tournament_cycles enable row level security;
alter table public.tournament_matches enable row level security;
drop policy if exists "members read tournament cycles" on public.tournament_cycles;
create policy "members read tournament cycles" on public.tournament_cycles for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "coaches manage tournament cycles" on public.tournament_cycles;
create policy "coaches manage tournament cycles" on public.tournament_cycles for all to authenticated using (exists(select 1 from public.team_members tm where tm.team_id=tournament_cycles.team_id and tm.user_id=auth.uid() and tm.status='active' and tm.membership_role in ('owner','coach'))) with check (exists(select 1 from public.team_members tm where tm.team_id=tournament_cycles.team_id and tm.user_id=auth.uid() and tm.status='active' and tm.membership_role in ('owner','coach')));
drop policy if exists "members read tournament matches" on public.tournament_matches;
create policy "members read tournament matches" on public.tournament_matches for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "coaches manage tournament matches" on public.tournament_matches;
create policy "coaches manage tournament matches" on public.tournament_matches for all to authenticated using (exists(select 1 from public.team_members tm where tm.team_id=tournament_matches.team_id and tm.user_id=auth.uid() and tm.status='active' and tm.membership_role in ('owner','coach'))) with check (exists(select 1 from public.team_members tm where tm.team_id=tournament_matches.team_id and tm.user_id=auth.uid() and tm.status='active' and tm.membership_role in ('owner','coach')));
