alter table public.practice_plans add column if not exists map_name text not null default '';
alter table public.practice_plans add column if not exists drop_zone text not null default '';
alter table public.practice_plans add column if not exists rotation_notes text not null default '';
alter table public.practice_plans add column if not exists scrim_matches integer check(scrim_matches between 1 and 20);
alter table public.practice_plans add column if not exists rules_notes text not null default '';
