
create or replace function public.seed_tournament_match_slots()
returns trigger language plpgsql security invoker set search_path=public
as $$
begin
 insert into public.tournament_matches(cycle_id,team_id,match_day,match_number,status)
 select new.id,new.team_id,d,m,'scheduled'
 from generate_series(1,7) d cross join generate_series(1,6) m
 on conflict(cycle_id,match_day,match_number) do nothing;
 return new;
end; $$;
drop trigger if exists trg_seed_tournament_slots on public.tournament_cycles;
create trigger trg_seed_tournament_slots after insert on public.tournament_cycles
for each row execute function public.seed_tournament_match_slots();
