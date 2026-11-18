drop policy "record owners update scrims" on public.scrim_records;
create policy "record owners update scrims" on public.scrim_records
for update to authenticated
using (owner_id=(select auth.uid()) and exists(select 1 from public.team_members tm where tm.team_id=scrim_records.team_id and tm.user_id=(select auth.uid()) and tm.status='active'))
with check (owner_id=(select auth.uid()) and exists(select 1 from public.team_members tm where tm.team_id=scrim_records.team_id and tm.user_id=(select auth.uid()) and tm.status='active'));