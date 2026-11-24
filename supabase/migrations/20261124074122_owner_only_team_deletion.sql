-- Owner-only, team-scoped permanent deletion.
-- All team-owned child tables reference teams(id) with ON DELETE CASCADE.
create or replace function public.delete_team_for_team(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'Not signed in';
  end if;

  select t.owner_id
    into v_owner
    from public.teams t
   where t.id = p_team_id
   for update;

  if v_owner is null then
    raise exception 'Team not found';
  end if;

  if v_owner <> v_user then
    raise exception 'Only the team owner can delete this team';
  end if;

  delete from public.teams
   where id = p_team_id
     and owner_id = v_user;

  if not found then
    raise exception 'Team deletion could not be confirmed';
  end if;

  return jsonb_build_object(
    'team_id', p_team_id,
    'deleted', true
  );
end;
$$;

revoke all on function public.delete_team_for_team(uuid) from public, anon;
grant execute on function public.delete_team_for_team(uuid) to authenticated;
