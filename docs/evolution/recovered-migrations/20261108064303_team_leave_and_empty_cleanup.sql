
alter table public.teams
  add column if not exists deletion_scheduled_at timestamptz,
  add column if not exists deletion_reason text;

create or replace function public.cancel_empty_team_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    update public.teams
       set deletion_scheduled_at = null, deletion_reason = null, updated_at = now()
     where id = new.team_id and deletion_scheduled_at is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cancel_empty_team_cleanup on public.team_members;
create trigger trg_cancel_empty_team_cleanup
after insert or update of status on public.team_members
for each row execute function public.cancel_empty_team_cleanup();

drop function if exists public.leave_team(uuid);
create function public.leave_team(p_new_owner uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_owner uuid;
  v_active_count integer;
  v_delete_at timestamptz;
begin
  if v_user is null then raise exception 'Not signed in'; end if;

  select tm.team_id into v_team
    from public.team_members tm
   where tm.user_id = v_user and tm.status = 'active'
   limit 1
   for update;
  if v_team is null then raise exception 'No active team membership found'; end if;

  select t.owner_id into v_owner
    from public.teams t where t.id = v_team for update;
  if v_owner is null then raise exception 'Team not found'; end if;

  select count(*) into v_active_count
    from public.team_members
   where team_id = v_team and status = 'active' and user_id <> v_user;

  if v_owner = v_user and v_active_count > 0 then
    if p_new_owner is null then
      raise exception 'Choose an active teammate to transfer team ownership before leaving';
    end if;
    if not exists (
      select 1 from public.team_members
       where team_id = v_team and user_id = p_new_owner and status = 'active'
    ) then raise exception 'The new owner must be an active team member'; end if;

    update public.teams set owner_id = p_new_owner, updated_at = now() where id = v_team;
    update public.team_members
       set membership_role = case when user_id = p_new_owner then 'owner' else 'player' end
     where team_id = v_team and status = 'active';
  elsif p_new_owner is not null then
    raise exception 'Only the current owner can transfer ownership';
  end if;

  update public.team_settings
     set setting_value = 'null'::jsonb, updated_at = now()
   where team_id = v_team and setting_key = 'igl_user_id'
     and setting_value = to_jsonb(v_user::text);

  delete from public.team_members where team_id = v_team and user_id = v_user;

  select count(*) into v_active_count
    from public.team_members where team_id = v_team and status = 'active';

  if v_active_count = 0 then
    v_delete_at := now() + interval '48 hours';
    update public.teams
       set deletion_scheduled_at = v_delete_at,
           deletion_reason = 'empty_team_after_member_leave',
           updated_at = now()
     where id = v_team;
  else
    v_delete_at := null;
    update public.teams
       set deletion_scheduled_at = null, deletion_reason = null, updated_at = now()
     where id = v_team;
  end if;

  return jsonb_build_object(
    'team_id', v_team,
    'remaining_active_members', v_active_count,
    'deletion_scheduled_at', v_delete_at,
    'ownership_transferred_to', case when v_owner = v_user and p_new_owner is not null then p_new_owner else null end
  );
end;
$$;

revoke all on function public.leave_team(uuid) from public, anon;
grant execute on function public.leave_team(uuid) to authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname = 'squad-os-empty-team-cleanup';

select cron.schedule(
  'squad-os-empty-team-cleanup',
  '15 3 * * *',
  $job$
    delete from public.teams t
     where t.deletion_scheduled_at is not null
       and t.deletion_scheduled_at <= now()
       and not exists (
         select 1 from public.team_members tm
          where tm.team_id = t.id and tm.status = 'active'
       );
  $job$
);
