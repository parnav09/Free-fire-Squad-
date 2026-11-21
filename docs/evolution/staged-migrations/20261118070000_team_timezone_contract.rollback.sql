-- Rollback for the staged Evolution Phase One.5-B timezone contract.
-- Removes only the trigger and function introduced by the forward migration.
-- The legacy Asia/Calcutta row remains normalized to Asia/Kolkata: reverting
-- stored timezone data would reintroduce a deprecated alias and is not needed
-- to safely remove the write guard.
-- Daily Evaluation triggers, functions, policies, and historical rows are
-- deliberately untouched because the forward migration does not change them.

DROP TRIGGER IF EXISTS teams_validate_timezone ON public.teams;
DROP FUNCTION IF EXISTS public.validate_team_timezone();
