-- SQUAD OS Scrims personal tracker + collaborative team review (feature branch only)
create table if not exists public.scrim_records (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 scrim_date date not null,
 match_count smallint not null check (match_count in (3,4,6)),
 matches jsonb not null default '[]'::jsonb check (jsonb_typeof(matches)='array'),
 overall_rank integer check (overall_rank is null or overall_rank > 0),
 total_teams integer check (total_teams is null or total_teams > 0),
 personal_review jsonb not null default '{"strengths":[],"mistakes":[],"notes":"","nextGoal":"","reviewed":false}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(team_id,owner_id,scrim_date)
);
create table if not exists public.scrim_team_reviews (
 id uuid primary key default gen_random_uuid(),
 scrim_id uuid not null references public.scrim_records(id) on delete cascade,
 team_id uuid not null references public.teams(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('mistake','positive')),
 match_number smallint check(match_number is null or match_number between 1 and 6),
 title text not null check(length(trim(title)) between 1 and 120),
 detail text not null check(length(trim(detail)) between 1 and 2000),
 solution text not null default '' check(length(solution)<=2000),
 created_at timestamptz not null default now()
);
create index if not exists scrim_records_team_date_idx on public.scrim_records(team_id,scrim_date desc);
create index if not exists scrim_team_reviews_scrim_idx on public.scrim_team_reviews(scrim_id,created_at desc);
alter table public.scrim_records enable row level security;
alter table public.scrim_team_reviews enable row level security;
create policy "team members read scrim records" on public.scrim_records for select to authenticated using (exists(select 1 from public.team_members tm where tm.team_id=scrim_records.team_id and tm.user_id=auth.uid() and tm.status='active'));
create policy "record owners create scrims" on public.scrim_records for insert to authenticated with check (owner_id=auth.uid() and exists(select 1 from public.team_members tm where tm.team_id=scrim_records.team_id and tm.user_id=auth.uid() and tm.status='active'));
create policy "record owners update scrims" on public.scrim_records for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "record owners delete scrims" on public.scrim_records for delete to authenticated using (owner_id=auth.uid());
create policy "team members read team reviews" on public.scrim_team_reviews for select to authenticated using (exists(select 1 from public.team_members tm where tm.team_id=scrim_team_reviews.team_id and tm.user_id=auth.uid() and tm.status='active'));
create policy "team members add team reviews" on public.scrim_team_reviews for insert to authenticated with check (author_id=auth.uid() and exists(select 1 from public.team_members tm where tm.team_id=scrim_team_reviews.team_id and tm.user_id=auth.uid() and tm.status='active') and exists(select 1 from public.scrim_records sr where sr.id=scrim_team_reviews.scrim_id and sr.team_id=scrim_team_reviews.team_id));
create policy "authors delete own team reviews" on public.scrim_team_reviews for delete to authenticated using (author_id=auth.uid());
