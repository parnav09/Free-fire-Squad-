-- Restrict custom tournament event management to team owners/coaches.
-- The designated IGL may also update result/standing data, while ordinary members remain read-only.
drop policy if exists tournament_event_records_insert_member on public.tournament_event_records;
create policy tournament_event_records_insert_manager on public.tournament_event_records
  for insert to authenticated
  with check (
    public.is_team_member(team_id)
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id = tournament_event_records.team_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and tm.membership_role in ('owner', 'coach')
    )
  );

drop policy if exists tournament_event_records_update_member on public.tournament_event_records;
create policy tournament_event_records_update_igl_manager on public.tournament_event_records
  for update to authenticated
  using (
    public.is_team_member(team_id)
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id = tournament_event_records.team_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and (
          tm.membership_role in ('owner', 'coach')
          or exists (
            select 1
            from public.team_settings ts
            where ts.team_id = tournament_event_records.team_id
              and ts.setting_key = 'igl_user_id'
              and ts.setting_value #>> '{}' = tm.user_id::text
          )
        )
    )
  )
  with check (
    public.is_team_member(team_id)
    and updated_by = (select auth.uid())
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id = tournament_event_records.team_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and (
          tm.membership_role in ('owner', 'coach')
          or exists (
            select 1
            from public.team_settings ts
            where ts.team_id = tournament_event_records.team_id
              and ts.setting_key = 'igl_user_id'
              and ts.setting_value #>> '{}' = tm.user_id::text
          )
        )
    )
  );

drop policy if exists tournament_event_records_delete_member on public.tournament_event_records;
create policy tournament_event_records_delete_manager on public.tournament_event_records
  for delete to authenticated
  using (
    public.is_team_member(team_id)
    and exists (
      select 1
      from public.team_members tm
      where tm.team_id = tournament_event_records.team_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and tm.membership_role in ('owner', 'coach')
    )
  );
