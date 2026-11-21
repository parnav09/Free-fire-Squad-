
create or replace function public.set_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare n text:=trim(p_name);
begin
 if auth.uid() is null then raise exception 'Not signed in'; end if;
 if char_length(n)<2 or char_length(n)>40 then raise exception 'IGN must be 2 to 40 characters'; end if;
 update public.profiles set display_name=n where id=auth.uid();
end;
$$;
revoke all on function public.set_display_name(text) from public,anon;
grant execute on function public.set_display_name(text) to authenticated;
