
create table if not exists public.training_session_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  note_date date not null,
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint training_session_notes_team_date_key unique (team_id, note_date)
);
alter table public.training_session_notes enable row level security;
revoke all on public.training_session_notes from anon;
grant select, insert, update on public.training_session_notes to authenticated;
drop policy if exists tsn_select on public.training_session_notes;
drop policy if exists tsn_insert on public.training_session_notes;
drop policy if exists tsn_update on public.training_session_notes;
create policy tsn_select on public.training_session_notes for select to authenticated
  using (public.is_team_member(team_id));
create policy tsn_insert on public.training_session_notes for insert to authenticated
  with check (public.is_team_member(team_id) and updated_by = (select auth.uid()));
create policy tsn_update on public.training_session_notes for update to authenticated
  using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id) and updated_by = (select auth.uid()));
create index if not exists idx_training_session_notes_team_date
  on public.training_session_notes(team_id, note_date desc);

create index if not exists idx_player_drill_assignments_team_id on public.player_drill_assignments(team_id);
create index if not exists idx_tournament_cycles_created_by on public.tournament_cycles(created_by);
create index if not exists idx_tournament_matches_recorded_by on public.tournament_matches(recorded_by);
create index if not exists idx_tournament_matches_verified_by on public.tournament_matches(verified_by);

drop policy if exists pda_select on public.player_drill_assignments;
drop policy if exists pda_insert on public.player_drill_assignments;
drop policy if exists pda_update on public.player_drill_assignments;
drop policy if exists pda_delete on public.player_drill_assignments;
create policy pda_select on public.player_drill_assignments for select to authenticated
  using (public.is_team_member(team_id));
create policy pda_insert on public.player_drill_assignments for insert to authenticated
  with check (
    assigned_by = (select auth.uid())
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = player_drill_assignments.team_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and tm.membership_role in ('owner','coach')
    )
  );
create policy pda_update on public.player_drill_assignments for update to authenticated
  using (
    player_id = (select auth.uid())
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = player_drill_assignments.team_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and tm.membership_role in ('owner','coach')
    )
  )
  with check (
    player_id = (select auth.uid())
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = player_drill_assignments.team_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and tm.membership_role in ('owner','coach')
    )
  );
create policy pda_delete on public.player_drill_assignments for delete to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = player_drill_assignments.team_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and tm.membership_role in ('owner','coach')
    )
  );
revoke update on public.player_drill_assignments from public, anon, authenticated;
grant update(status, completed_at, completion_note) on public.player_drill_assignments to authenticated;

drop policy if exists "coaches manage tournament cycles" on public.tournament_cycles;
create policy "coaches insert tournament cycles" on public.tournament_cycles for insert to authenticated
  with check (exists (select 1 from public.team_members tm where tm.team_id=tournament_cycles.team_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.membership_role in ('owner','coach')));
create policy "coaches update tournament cycles" on public.tournament_cycles for update to authenticated
  using (exists (select 1 from public.team_members tm where tm.team_id=tournament_cycles.team_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.membership_role in ('owner','coach')))
  with check (exists (select 1 from public.team_members tm where tm.team_id=tournament_cycles.team_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.membership_role in ('owner','coach')));
create policy "coaches delete tournament cycles" on public.tournament_cycles for delete to authenticated
  using (exists (select 1 from public.team_members tm where tm.team_id=tournament_cycles.team_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.membership_role in ('owner','coach')));

drop policy if exists "coaches manage tournament matches" on public.tournament_matches;
create policy "coaches insert tournament matches" on public.tournament_matches for insert to authenticated
  with check (exists (select 1 from public.team_members tm where tm.team_id=tournament_matches.team_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.membership_role in ('owner','coach')));
create policy "coaches update tournament matches" on public.tournament_matches for update to authenticated
  using (exists (select 1 from public.team_members tm where tm.team_id=tournament_matches.team_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.membership_role in ('owner','coach')))
  with check (exists (select 1 from public.team_members tm where tm.team_id=tournament_matches.team_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.membership_role in ('owner','coach')));
create policy "coaches delete tournament matches" on public.tournament_matches for delete to authenticated
  using (exists (select 1 from public.team_members tm where tm.team_id=tournament_matches.team_id and tm.user_id=(select auth.uid()) and tm.status='active' and tm.membership_role in ('owner','coach')));

-- Trigger-only functions and the public slot seeder are not API endpoints.
revoke execute on function public.fix_role() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.seed_tournament_match_slots() from public, anon, authenticated;

-- Wrap direct auth.uid() policy references in a scalar subquery so PostgreSQL
-- evaluates the identity once per statement rather than once per row.
do $$
declare p record; q text; w text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname='public'
      and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%')
  loop
    q := case when p.qual is null then null else regexp_replace(p.qual, 'auth\.uid\(\)', '(select auth.uid())', 'g') end;
    w := case when p.with_check is null then null else regexp_replace(p.with_check, 'auth\.uid\(\)', '(select auth.uid())', 'g') end;
    if q is not null and w is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, q, w);
    elsif q is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, q);
    elsif w is not null then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, w);
    end if;
  end loop;
end $$;
