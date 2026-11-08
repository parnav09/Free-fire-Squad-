-- Fix PostgREST PGRST203: two set_display_name overloads were both callable
-- with p_name only because the team-specific overload had a DEFAULT NULL.
-- Keep both call shapes but make p_team_id required on the 2-arg overload.
create or replace function public.set_display_name(p_name text, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n text := trim(p_name);
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not signed in'; end if;
  if char_length(n) < 2 or char_length(n) > 40 then raise exception 'IGN must be 2 to 40 characters'; end if;
  if p_team_id is null then
    update public.profiles set display_name=n where id=v_user;
  else
    if not exists(select 1 from public.team_members where team_id=p_team_id and user_id=v_user and status='active') then
      raise exception 'You are not an active member of this team';
    end if;
    if exists(select 1 from public.team_members where team_id=p_team_id and user_id<>v_user and status='active' and lower(btrim(display_name))=lower(btrim(n))) then
      raise exception 'This IGN is already used by another player in this team';
    end if;
    update public.team_members set display_name=n where team_id=p_team_id and user_id=v_user;
  end if;
end;
$function$;

revoke all on function public.set_display_name(text,uuid) from public, anon;
grant execute on function public.set_display_name(text,uuid) to authenticated;
notify pgrst, 'reload schema';
