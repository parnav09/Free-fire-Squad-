-- Evolution Phase One acceptance fix: protect membership identity and permission columns.
-- tm_update_character_loadout is a row-level policy; it cannot restrict which
-- columns a caller updates. Keep direct self-service updates limited to the
-- character_loadout column and route roster assignments through an owner RPC.


REVOKE UPDATE ON TABLE public.team_members FROM authenticated;
REVOKE UPDATE (
  id,
  team_id,
  user_id,
  display_name,
  player_number,
  assigned_role,
  membership_role,
  status,
  joined_at,
  character_loadout
) ON TABLE public.team_members FROM authenticated;

GRANT UPDATE (character_loadout) ON TABLE public.team_members TO authenticated;

CREATE OR REPLACE FUNCTION public.set_member_assignment(
  p_member uuid,
  p_player smallint,
  p_role text,
  p_activate boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_team_id uuid;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  v_role := nullif(btrim(p_role), '');
  IF v_role IS NULL OR char_length(v_role) > 32 THEN
    RAISE EXCEPTION 'Invalid assigned role';
  END IF;

  SELECT tm.team_id
    INTO v_team_id
    FROM public.team_members AS tm
   WHERE tm.id = p_member
   FOR UPDATE;

  IF v_team_id IS NULL OR NOT public.is_team_owner(v_team_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_player IS NOT NULL THEN
    PERFORM public.assign_member(p_member, p_player, coalesce(p_activate, true));
  END IF;

  UPDATE public.team_members
     SET assigned_role = v_role
   WHERE id = p_member
     AND team_id = v_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_member_assignment(uuid, smallint, text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_assignment(uuid, smallint, text, boolean)
  TO authenticated;

