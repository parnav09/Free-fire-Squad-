-- Historical migration source restored for ledger version 20261114100112.
-- The original SQL file was not retained in Git history. This reconstruction
-- matches the live public.character_profiles schema inspected on 18 Nov 2026.
-- It is a source-of-truth restoration for clean database builds, not a request
-- to reapply or alter the already-provisioned production table.

create table if not exists public.character_profiles (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.character_profiles enable row level security;

drop policy if exists "Public read character profiles" on public.character_profiles;

create policy "Public read character profiles"
  on public.character_profiles
  for select
  to public
  using (true);
