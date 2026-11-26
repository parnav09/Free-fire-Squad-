create table if not exists public.tournament_event_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  event_data jsonb not null default '{"days":[]}'::jsonb
    check (jsonb_typeof(event_data) = 'object' and jsonb_typeof(event_data->'days') = 'array'),
  revision bigint not null default 1 check (revision >= 1),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_event_records_team_id_id_key unique (team_id, id)
);
create index if not exists tournament_event_records_team_updated_idx
  on public.tournament_event_records (team_id, updated_at desc);
alter table public.tournament_event_records enable row level security;
drop policy if exists tournament_event_records_select_member on public.tournament_event_records;
create policy tournament_event_records_select_member on public.tournament_event_records
  for select to authenticated using (public.is_team_member(team_id));
drop policy if exists tournament_event_records_insert_member on public.tournament_event_records;
create policy tournament_event_records_insert_member on public.tournament_event_records
  for insert to authenticated with check (
    public.is_team_member(team_id) and created_by = (select auth.uid()) and updated_by = (select auth.uid())
  );
drop policy if exists tournament_event_records_update_member on public.tournament_event_records;
create policy tournament_event_records_update_member on public.tournament_event_records
  for update to authenticated using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id) and updated_by = (select auth.uid()));
drop policy if exists tournament_event_records_delete_member on public.tournament_event_records;
create policy tournament_event_records_delete_member on public.tournament_event_records
  for delete to authenticated using (public.is_team_member(team_id));
grant select, insert, update, delete on public.tournament_event_records to authenticated;
create or replace function public.set_tournament_event_record_updated_at()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;
revoke all on function public.set_tournament_event_record_updated_at() from public, anon, authenticated;
drop trigger if exists tournament_event_records_updated_at on public.tournament_event_records;
create trigger tournament_event_records_updated_at
before update on public.tournament_event_records
for each row execute function public.set_tournament_event_record_updated_at();
