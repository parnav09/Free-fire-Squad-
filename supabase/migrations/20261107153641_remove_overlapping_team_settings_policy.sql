
create index if not exists idx_training_session_notes_updated_by
  on public.training_session_notes(updated_by);

drop policy if exists ts_write on public.team_settings;
create policy ts_insert on public.team_settings for insert to authenticated
  with check (public.is_team_owner(team_id));
create policy ts_update on public.team_settings for update to authenticated
  using (public.is_team_owner(team_id))
  with check (public.is_team_owner(team_id));
create policy ts_delete on public.team_settings for delete to authenticated
  using (public.is_team_owner(team_id));
