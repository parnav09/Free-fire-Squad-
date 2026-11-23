-- Character assignment fields are stored separately from profile catalogue data.
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS character_loadout jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_character_loadout_object;
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_character_loadout_object
  CHECK (jsonb_typeof(character_loadout) = 'object');

-- A player may edit their own character; team owners may manage all members.
DROP POLICY IF EXISTS tm_update_character_loadout ON public.team_members;
CREATE POLICY tm_update_character_loadout
ON public.team_members
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id OR is_team_owner(team_id))
WITH CHECK ((SELECT auth.uid()) = user_id OR is_team_owner(team_id));

COMMENT ON COLUMN public.team_members.character_loadout IS
'Per-player character selection and skill/pet/weapon loadout. Character catalogue remains canonical in Git JSON and mirrored in character_profiles.';
