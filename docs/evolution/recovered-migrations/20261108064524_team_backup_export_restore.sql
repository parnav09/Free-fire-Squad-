
create or replace function public.get_team_backup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_team_json jsonb;
  v_tables jsonb := '{}'::jsonb;
  v_table text;
  v_rows jsonb;
begin
  if v_user is null then raise exception 'Not signed in'; end if;
  select t.id into v_team
    from public.teams t
    join public.team_members tm on tm.team_id=t.id
   where t.owner_id=v_user and tm.user_id=v_user and tm.status='active'
   limit 1;
  if v_team is null then raise exception 'Only the active team owner can create a backup'; end if;

  select jsonb_build_object(
    'team_name', team_name,
    'team_description', team_description,
    'timezone', timezone,
    'avatar_url', avatar_url,
    'created_at', created_at
  ) into v_team_json from public.teams where id=v_team;

  foreach v_table in array array[
    'team_members','team_settings','team_join_requests','team_ratings',
    'daily_drills','daily_scores','player_drill_assignments','player_nicknames',
    'training_log','training_session_notes','tournament_cycles','tournament_matches'
  ] loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.team_id = $1',
      v_table
    ) into v_rows using v_team;
    v_tables := v_tables || jsonb_build_object(v_table, coalesce(v_rows,'[]'::jsonb));
  end loop;

  return jsonb_build_object(
    'format','squad-os-team-backup',
    'schema_version',1,
    'exported_at',now(),
    'team',v_team_json,
    'tables',v_tables
  );
end;
$$;

create or replace function public.restore_team_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_team uuid;
  v_tables jsonb;
  v_table text;
  v_rows jsonb;
  v_row jsonb;
  v_new_row jsonb;
  v_old_cycle text;
  v_new_cycle uuid;
  v_cycle_map jsonb := '{}'::jsonb;
  v_uid uuid;
  v_count integer := 0;
begin
  if v_user is null then raise exception 'Not signed in'; end if;
  if p_backup->>'format' <> 'squad-os-team-backup' or (p_backup->>'schema_version')::integer <> 1 then
    raise exception 'Unsupported backup file. Use a SQUAD OS version 1 backup.';
  end if;

  select t.id into v_team
    from public.teams t
    join public.team_members tm on tm.team_id=t.id
   where t.owner_id=v_user and tm.user_id=v_user and tm.status='active'
   limit 1
   for update;
  if v_team is null then raise exception 'Only the active team owner can import a backup'; end if;

  v_tables := p_backup->'tables';
  if jsonb_typeof(v_tables) <> 'object' then raise exception 'Backup tables are missing'; end if;

  -- Replace team-owned rows in dependency-safe order. The signed-in owner membership is retained.
  delete from public.tournament_matches where team_id=v_team;
  delete from public.daily_drills where team_id=v_team;
  delete from public.daily_scores where team_id=v_team;
  delete from public.player_drill_assignments where team_id=v_team;
  delete from public.player_nicknames where team_id=v_team;
  delete from public.team_join_requests where team_id=v_team;
  delete from public.team_ratings where team_id=v_team;
  delete from public.team_settings where team_id=v_team;
  delete from public.training_log where team_id=v_team;
  delete from public.training_session_notes where team_id=v_team;
  delete from public.tournament_cycles where team_id=v_team;
  delete from public.team_members where team_id=v_team and user_id<>v_user;

  -- Restore roster while keeping the current account as the team's owner.
  v_rows := coalesce(v_tables->'team_members','[]'::jsonb);
  if jsonb_typeof(v_rows) <> 'array' then raise exception 'Invalid roster data in backup'; end if;
  for v_row in select value from jsonb_array_elements(v_rows) loop
    v_uid := (v_row->>'user_id')::uuid;
    if v_uid = v_user then
      update public.team_members
         set player_number = nullif(v_row->>'player_number','')::smallint,
             assigned_role = v_row->>'assigned_role',
             membership_role = 'owner',
             status = 'active'
       where team_id=v_team and user_id=v_user;
    else
      v_new_row := jsonb_set(v_row,'{id}',to_jsonb(gen_random_uuid()::text),true);
      v_new_row := jsonb_set(v_new_row,'{team_id}',to_jsonb(v_team::text),true);
      v_new_row := jsonb_set(v_new_row,'{membership_role}',to_jsonb('player'::text),true);
      insert into public.team_members
      select (jsonb_populate_record(null::public.team_members,v_new_row)).*;
    end if;
  end loop;

  -- Restore cycles first and create an old-to-new ID map for their match rows.
  v_rows := coalesce(v_tables->'tournament_cycles','[]'::jsonb);
  if jsonb_typeof(v_rows) <> 'array' then raise exception 'Invalid tournament cycle data'; end if;
  for v_row in select value from jsonb_array_elements(v_rows) loop
    v_old_cycle := v_row->>'id';
    v_new_cycle := gen_random_uuid();
    v_cycle_map := v_cycle_map || jsonb_build_object(v_old_cycle,v_new_cycle::text);
    v_new_row := jsonb_set(v_row,'{id}',to_jsonb(v_new_cycle::text),true);
    v_new_row := jsonb_set(v_new_row,'{team_id}',to_jsonb(v_team::text),true);
    insert into public.tournament_cycles
    select (jsonb_populate_record(null::public.tournament_cycles,v_new_row)).*;
    v_count := v_count + 1;
  end loop;

  foreach v_table in array array[
    'team_settings','team_join_requests','team_ratings','daily_drills',
    'daily_scores','player_drill_assignments','player_nicknames',
    'training_log','training_session_notes'
  ] loop
    v_rows := coalesce(v_tables->v_table,'[]'::jsonb);
    if jsonb_typeof(v_rows) <> 'array' then raise exception 'Invalid data array for %',v_table; end if;
    for v_row in select value from jsonb_array_elements(v_rows) loop
      v_new_row := jsonb_set(v_row,'{id}',to_jsonb(gen_random_uuid()::text),true);
      v_new_row := jsonb_set(v_new_row,'{team_id}',to_jsonb(v_team::text),true);
      execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).*',v_table,v_table)
        using v_new_row;
      v_count := v_count + 1;
    end loop;
  end loop;

  v_rows := coalesce(v_tables->'tournament_matches','[]'::jsonb);
  if jsonb_typeof(v_rows) <> 'array' then raise exception 'Invalid tournament match data'; end if;
  for v_row in select value from jsonb_array_elements(v_rows) loop
    v_old_cycle := v_row->>'cycle_id';
    v_new_cycle := (v_cycle_map->>v_old_cycle)::uuid;
    if v_new_cycle is null then raise exception 'Backup contains a match without its tournament cycle'; end if;
    v_new_row := jsonb_set(v_row,'{id}',to_jsonb(gen_random_uuid()::text),true);
    v_new_row := jsonb_set(v_new_row,'{team_id}',to_jsonb(v_team::text),true);
    v_new_row := jsonb_set(v_new_row,'{cycle_id}',to_jsonb(v_new_cycle::text),true);
    insert into public.tournament_matches
    select (jsonb_populate_record(null::public.tournament_matches,v_new_row)).*;
    v_count := v_count + 1;
  end loop;

  update public.teams
     set team_name = coalesce(nullif(p_backup->'team'->>'team_name',''),team_name),
         team_description = p_backup->'team'->>'team_description',
         timezone = coalesce(nullif(p_backup->'team'->>'timezone',''),timezone),
         avatar_url = p_backup->'team'->>'avatar_url',
         deletion_scheduled_at = null,
         deletion_reason = null,
         updated_at = now()
   where id=v_team;

  return jsonb_build_object('restored_rows',v_count,'team_id',v_team,'restored_at',now());
end;
$$;

revoke all on function public.get_team_backup() from public, anon;
grant execute on function public.get_team_backup() to authenticated;
revoke all on function public.restore_team_backup(jsonb) from public, anon;
grant execute on function public.restore_team_backup(jsonb) to authenticated;
