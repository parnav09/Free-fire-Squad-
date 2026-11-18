create or replace function public.assign_member(p_member uuid, p_player smallint, p_activate boolean default true)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare t uuid; cap integer;
begin
 select team_id into t from public.team_members where id=p_member;
 if t is null or not public.is_team_owner(t) then raise exception 'Not allowed'; end if;
 select coalesce((setting_value #>> '{}')::integer,
   case when exists(select 1 from public.team_settings where team_id=t and setting_key='fifth_player' and setting_value='true'::jsonb) then 5 else 4 end)
 into cap from public.team_settings where team_id=t and setting_key='roster_capacity';
 if cap is null then
   select case when exists(select 1 from public.team_settings where team_id=t and setting_key='fifth_player' and setting_value='true'::jsonb) then 5 else 4 end into cap;
 end if;
 if p_player<1 or p_player>cap then raise exception 'Player slot is outside configured roster capacity'; end if;
 update public.team_members set player_number=p_player,status=case when p_activate then 'active' else status end where id=p_member;
end;
$function$;
revoke all on function public.assign_member(uuid,smallint,boolean) from public,anon;
grant execute on function public.assign_member(uuid,smallint,boolean) to authenticated;