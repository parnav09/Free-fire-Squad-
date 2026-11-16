create table if not exists public.player_character_loadouts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active_character_id text not null,
  passive_character_ids text[] not null default array[]::text[],
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_character_loadouts_one_per_member unique(team_member_id),
  constraint player_character_loadouts_three_passives check (cardinality(passive_character_ids) <= 3)
);
alter table public.player_character_loadouts enable row level security;
grant select,insert,update,delete on public.player_character_loadouts to authenticated;
drop policy if exists pcl_select_team on public.player_character_loadouts;
create policy pcl_select_team on public.player_character_loadouts for select to authenticated using (is_team_member(team_id));
drop policy if exists pcl_insert_owner_or_self on public.player_character_loadouts;
create policy pcl_insert_owner_or_self on public.player_character_loadouts for insert to authenticated with check (
  is_team_owner(team_id) or (user_id = (select auth.uid()) and is_team_member(team_id))
);
drop policy if exists pcl_update_owner_or_self on public.player_character_loadouts;
create policy pcl_update_owner_or_self on public.player_character_loadouts for update to authenticated using (
  is_team_owner(team_id) or (user_id = (select auth.uid()) and is_team_member(team_id))
) with check (
  is_team_owner(team_id) or (user_id = (select auth.uid()) and is_team_member(team_id))
);
drop policy if exists pcl_delete_owner on public.player_character_loadouts;
create policy pcl_delete_owner on public.player_character_loadouts for delete to authenticated using (is_team_owner(team_id));
create index if not exists player_character_loadouts_team_idx on public.player_character_loadouts(team_id);
create index if not exists player_character_loadouts_member_idx on public.player_character_loadouts(team_member_id);
