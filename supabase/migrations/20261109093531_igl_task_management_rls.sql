-- Designated IGL may manage squad assignments without gaining coach-level access to other modules.
drop policy if exists practice_tasks_igl_manage on public.practice_tasks;
create policy practice_tasks_igl_manage on public.practice_tasks for all to authenticated
using (exists(select 1 from public.team_members tm where tm.team_id=practice_tasks.team_id and tm.user_id=auth.uid() and tm.status='active' and coalesce(tm.assigned_role,'') ilike '%igl%'))
with check (exists(select 1 from public.team_members tm where tm.team_id=practice_tasks.team_id and tm.user_id=auth.uid() and tm.status='active' and coalesce(tm.assigned_role,'') ilike '%igl%'));
