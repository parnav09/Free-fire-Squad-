create index if not exists tournament_event_records_created_by_idx
  on public.tournament_event_records (created_by);
create index if not exists tournament_event_records_updated_by_idx
  on public.tournament_event_records (updated_by);
