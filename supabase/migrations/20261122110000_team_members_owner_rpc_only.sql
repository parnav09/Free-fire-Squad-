-- Evolution Phase One.5-E: remove broad client-side writes to identity rows.
-- Roster slot/assigned-role changes go through an owner-checked SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.assign_member_with_role(
  p_member uuid, p_player smallint, p_activate boolean, p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team uuid;
  v_capacity integer;
  v_role text := btrim(coalesce(p_role, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF v_role = '' OR char_length(v_role) > 32 OR v_role ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Role must be 1 to 32 printable characters';
  END IF;

  SELECT team_id INTO v_team
    FROM public.team_members WHERE id=p_member FOR UPDATE;
  IF v_team IS NULL OR NOT public.is_team_owner(v_team) THEN
    RAISE EXCEPTION 'Only an active team owner can assign a member';
  END IF;

  IF p_player IS NOT NULL THEN
    SELECT coalesce((setting_value #>> '{}')::integer,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.team_settings
         WHERE team_id=v_team AND setting_key='fifth_player' AND setting_value='true'::jsonb
      ) THEN 5 ELSE 4 END)
      INTO v_capacity
      FROM public.team_settings
     WHERE team_id=v_team AND setting_key='roster_capacity';
    IF v_capacity IS NULL THEN
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM public.team_settings
         WHERE team_id=v_team AND setting_key='fifth_player' AND setting_value='true'::jsonb
      ) THEN 5 ELSE 4 END INTO v_capacity;
    END IF;
    IF p_player < 1 OR p_player > v_capacity THEN
      RAISE EXCEPTION 'Player slot is outside configured roster capacity';
    END IF;
  END IF;

  UPDATE public.team_members
     SET assigned_role=v_role,
         player_number=coalesce(p_player,player_number),
         status=CASE WHEN p_player IS NOT NULL AND coalesce(p_activate,false)
                     THEN 'active' ELSE status END
   WHERE id=p_member;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_member_with_role(uuid,smallint,boolean,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_member_with_role(uuid,smallint,boolean,text)
  TO authenticated;

REVOKE UPDATE ON TABLE public.team_members FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (
  id, team_id, user_id, player_number, assigned_role, membership_role,
  status, joined_at, display_name, character_loadout
) ON TABLE public.team_members FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS tm_update_character_loadout ON public.team_members;
