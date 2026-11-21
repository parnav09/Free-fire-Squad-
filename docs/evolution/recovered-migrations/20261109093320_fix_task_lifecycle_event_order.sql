-- Correct lifecycle logging to AFTER row persistence (event FK must see the task).
create or replace function public.set_practice_task_lifecycle_fields()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and new.status is distinct from old.status then
  if new.status='completed' then new.completed_at:=coalesce(new.completed_at,now());new.completion_submitted_by:=auth.uid();new.completion_acknowledged_at:=null;
  elsif new.status='reviewed' then new.reviewed_at:=coalesce(new.reviewed_at,now());new.completion_acknowledged_at:=coalesce(new.completion_acknowledged_at,now());
  elsif old.status in ('completed','reviewed') and new.status in ('assigned','in_progress') then new.completed_at:=null;new.completion_submitted_by:=null;new.completion_acknowledged_at:=null;new.reviewed_at:=null;
  end if;
 end if; return new;
end;$$;
create or replace function public.log_practice_task_lifecycle()
returns trigger language plpgsql security definer set search_path=public as $$ declare evt text;begin
 if tg_op='INSERT' then insert into public.practice_task_events(task_id,team_id,actor_id,event_type,to_status,note) values(new.id,new.team_id,new.assigned_by,'assigned',new.status,'Task assigned');return new;end if;
 if new.status is distinct from old.status then
 evt:=case new.status when 'in_progress' then 'started' when 'completed' then 'submitted' when 'reviewed' then 'reviewed' when 'blocked' then 'blocked' when 'cancelled' then 'cancelled' else 'reopened' end;
 insert into public.practice_task_events(task_id,team_id,actor_id,event_type,from_status,to_status,note) values(new.id,new.team_id,auth.uid(),evt,old.status,new.status,coalesce(new.completion_note,new.blocked_reason,''));
 end if;return new;end;$$;
drop trigger if exists practice_task_lifecycle on public.practice_tasks;
drop trigger if exists practice_task_lifecycle_fields on public.practice_tasks;
create trigger practice_task_lifecycle_fields before update of status on public.practice_tasks for each row execute function public.set_practice_task_lifecycle_fields();
create trigger practice_task_lifecycle after insert or update of status on public.practice_tasks for each row execute function public.log_practice_task_lifecycle();