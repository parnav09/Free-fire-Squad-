drop policy if exists practice_tasks_member_update on public.practice_tasks;
create policy practice_tasks_member_update on public.practice_tasks for update to authenticated
using (exists(select 1 from public.team_members tm where tm.id=practice_tasks.player_member_id and tm.team_id=practice_tasks.team_id and tm.user_id=auth.uid() and tm.status='active'))
with check (exists(select 1 from public.team_members tm where tm.id=practice_tasks.player_member_id and tm.team_id=practice_tasks.team_id and tm.user_id=auth.uid() and tm.status='active'));
