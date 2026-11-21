
do $$
declare d text;
begin
 d:=pg_get_functiondef('public.restore_team_backup_for_team(jsonb,uuid)'::regprocedure);
 d:=replace(d,
   'set player_number = nullif(v_row->>''player_number'','''')::smallint,',
   'set display_name = coalesce(nullif(v_row->>''display_name'',''''),display_name),' || chr(10) || '             player_number = nullif(v_row->>''player_number'','''')::smallint,'
 );
 execute d;
end $$;
