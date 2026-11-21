-- Evolution Phase Two.10 — Database Integrity
-- Additive, team-scoped integrity hardening. No legacy records are rewritten.
-- NOT VALID constraints are validated in this transaction; any mismatch aborts atomically.

CREATE UNIQUE INDEX IF NOT EXISTS practice_plans_id_team_uidx ON public.practice_plans(id,team_id);
CREATE UNIQUE INDEX IF NOT EXISTS practice_plan_blocks_id_team_uidx ON public.practice_plan_blocks(id,team_id);
CREATE UNIQUE INDEX IF NOT EXISTS team_members_id_team_uidx ON public.team_members(id,team_id);
CREATE UNIQUE INDEX IF NOT EXISTS training_sessions_id_team_uidx ON public.training_sessions(id,team_id);
CREATE UNIQUE INDEX IF NOT EXISTS scrim_records_id_team_uidx ON public.scrim_records(id,team_id);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_cycles_id_team_uidx ON public.tournament_cycles(id,team_id);

CREATE INDEX IF NOT EXISTS tournament_matches_cycle_team_idx ON public.tournament_matches(cycle_id,team_id);
CREATE INDEX IF NOT EXISTS practice_plan_blocks_plan_team_idx ON public.practice_plan_blocks(plan_id,team_id);
CREATE INDEX IF NOT EXISTS practice_tasks_plan_team_idx ON public.practice_tasks(plan_id,team_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS practice_tasks_block_team_idx ON public.practice_tasks(block_id,team_id) WHERE block_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS practice_tasks_member_team_idx ON public.practice_tasks(player_member_id,team_id) WHERE player_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS practice_tasks_source_session_team_idx ON public.practice_tasks(source_session_id,team_id) WHERE source_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS training_sessions_plan_team_idx ON public.training_sessions(plan_id,team_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS training_session_participants_session_team_idx ON public.training_session_participants(session_id,team_id);
CREATE INDEX IF NOT EXISTS training_session_participants_member_team_idx ON public.training_session_participants(player_member_id,team_id);
CREATE INDEX IF NOT EXISTS training_results_session_team_idx ON public.training_results(session_id,team_id);
CREATE INDEX IF NOT EXISTS training_results_member_team_idx ON public.training_results(player_member_id,team_id) WHERE player_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS scrim_team_reviews_scrim_team_idx ON public.scrim_team_reviews(scrim_id,team_id);

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.tournament_matches'::regclass AND conname='tournament_matches_cycle_team_fk') THEN
    ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_cycle_team_fk
      FOREIGN KEY(cycle_id,team_id) REFERENCES public.tournament_cycles(id,team_id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.practice_plan_blocks'::regclass AND conname='practice_plan_blocks_plan_team_fk') THEN
    ALTER TABLE public.practice_plan_blocks ADD CONSTRAINT practice_plan_blocks_plan_team_fk
      FOREIGN KEY(plan_id,team_id) REFERENCES public.practice_plans(id,team_id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.training_sessions'::regclass AND conname='training_sessions_plan_team_fk') THEN
    ALTER TABLE public.training_sessions ADD CONSTRAINT training_sessions_plan_team_fk
      FOREIGN KEY(plan_id,team_id) REFERENCES public.practice_plans(id,team_id) ON DELETE SET NULL (plan_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.practice_tasks'::regclass AND conname='practice_tasks_plan_team_fk') THEN
    ALTER TABLE public.practice_tasks ADD CONSTRAINT practice_tasks_plan_team_fk
      FOREIGN KEY(plan_id,team_id) REFERENCES public.practice_plans(id,team_id) ON DELETE SET NULL (plan_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.practice_tasks'::regclass AND conname='practice_tasks_block_team_fk') THEN
    ALTER TABLE public.practice_tasks ADD CONSTRAINT practice_tasks_block_team_fk
      FOREIGN KEY(block_id,team_id) REFERENCES public.practice_plan_blocks(id,team_id) ON DELETE SET NULL (block_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.practice_tasks'::regclass AND conname='practice_tasks_member_team_fk') THEN
    ALTER TABLE public.practice_tasks ADD CONSTRAINT practice_tasks_member_team_fk
      FOREIGN KEY(player_member_id,team_id) REFERENCES public.team_members(id,team_id) ON DELETE SET NULL (player_member_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.practice_tasks'::regclass AND conname='practice_tasks_source_session_team_fk') THEN
    ALTER TABLE public.practice_tasks ADD CONSTRAINT practice_tasks_source_session_team_fk
      FOREIGN KEY(source_session_id,team_id) REFERENCES public.training_sessions(id,team_id) ON DELETE SET NULL (source_session_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.training_session_participants'::regclass AND conname='training_session_participants_session_team_fk') THEN
    ALTER TABLE public.training_session_participants ADD CONSTRAINT training_session_participants_session_team_fk
      FOREIGN KEY(session_id,team_id) REFERENCES public.training_sessions(id,team_id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.training_session_participants'::regclass AND conname='training_session_participants_member_team_fk') THEN
    ALTER TABLE public.training_session_participants ADD CONSTRAINT training_session_participants_member_team_fk
      FOREIGN KEY(player_member_id,team_id) REFERENCES public.team_members(id,team_id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.training_results'::regclass AND conname='training_results_session_team_fk') THEN
    ALTER TABLE public.training_results ADD CONSTRAINT training_results_session_team_fk
      FOREIGN KEY(session_id,team_id) REFERENCES public.training_sessions(id,team_id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.training_results'::regclass AND conname='training_results_member_team_fk') THEN
    ALTER TABLE public.training_results ADD CONSTRAINT training_results_member_team_fk
      FOREIGN KEY(player_member_id,team_id) REFERENCES public.team_members(id,team_id) ON DELETE SET NULL (player_member_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.scrim_team_reviews'::regclass AND conname='scrim_team_reviews_scrim_team_fk') THEN
    ALTER TABLE public.scrim_team_reviews ADD CONSTRAINT scrim_team_reviews_scrim_team_fk
      FOREIGN KEY(scrim_id,team_id) REFERENCES public.scrim_records(id,team_id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.practice_plan_blocks'::regclass AND conname='practice_plan_blocks_linked_drill_fk') THEN
    ALTER TABLE public.practice_plan_blocks ADD CONSTRAINT practice_plan_blocks_linked_drill_fk
      FOREIGN KEY(linked_drill_id) REFERENCES public.training_drills(id) ON DELETE SET NULL NOT VALID;
  END IF;
END
$constraints$;

DO $scrim_check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.scrim_records'::regclass AND conname='scrim_records_match_count_matches_array_check') THEN
    ALTER TABLE public.scrim_records ADD CONSTRAINT scrim_records_match_count_matches_array_check
      CHECK (CASE WHEN jsonb_typeof(matches)='array' THEN jsonb_array_length(matches)=match_count ELSE false END) NOT VALID;
  END IF;
END
$scrim_check$;

-- NULL player_member_id means a session-level result; ordinary UNIQUE treats NULLs as distinct.
CREATE UNIQUE INDEX IF NOT EXISTS training_results_session_attempt_without_player_uidx
  ON public.training_results(session_id,attempt_number) WHERE player_member_id IS NULL;

CREATE SCHEMA IF NOT EXISTS evolution_private;
REVOKE ALL ON SCHEMA evolution_private FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION evolution_private.guard_team_scoped_training_references()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_drill_team_id uuid;
  v_drill_is_template boolean;
  v_block_plan_id uuid;
BEGIN
  IF TG_TABLE_NAME='training_drills' THEN
    IF NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.is_template IS DISTINCT FROM OLD.is_template THEN
      IF EXISTS (
        SELECT 1 FROM public.training_sessions s WHERE s.drill_id=OLD.id
          AND NOT (NEW.is_template AND NEW.team_id IS NULL)
          AND s.team_id IS DISTINCT FROM NEW.team_id
      ) OR EXISTS (
        SELECT 1 FROM public.practice_plan_blocks b WHERE b.linked_drill_id=OLD.id
          AND NOT (NEW.is_template AND NEW.team_id IS NULL)
          AND b.team_id IS DISTINCT FROM NEW.team_id
      ) THEN
        RAISE EXCEPTION 'training_drill_reassignment_breaks_team_reference' USING ERRCODE='23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME='training_sessions' AND NEW.drill_id IS NOT NULL THEN
    SELECT d.team_id,d.is_template INTO v_drill_team_id,v_drill_is_template
    FROM public.training_drills d WHERE d.id=NEW.drill_id FOR SHARE;
  ELSIF TG_TABLE_NAME='practice_plan_blocks' AND NEW.linked_drill_id IS NOT NULL THEN
    SELECT d.team_id,d.is_template INTO v_drill_team_id,v_drill_is_template
    FROM public.training_drills d WHERE d.id=NEW.linked_drill_id;
  END IF;

  IF (TG_TABLE_NAME='training_sessions' AND NEW.drill_id IS NOT NULL)
    OR (TG_TABLE_NAME='practice_plan_blocks' AND NEW.linked_drill_id IS NOT NULL) THEN
    IF NOT FOUND THEN RAISE EXCEPTION 'training_drill_reference_not_found' USING ERRCODE='23503'; END IF;
    IF NOT (v_drill_is_template AND v_drill_team_id IS NULL)
      AND v_drill_team_id IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'training_drill_team_mismatch' USING ERRCODE='23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME='practice_tasks' AND NEW.block_id IS NOT NULL THEN
    SELECT b.plan_id INTO v_block_plan_id FROM public.practice_plan_blocks b
    WHERE b.id=NEW.block_id AND b.team_id=NEW.team_id FOR SHARE;
    IF FOUND AND v_block_plan_id IS DISTINCT FROM NEW.plan_id THEN
      RAISE EXCEPTION 'practice_task_block_does_not_belong_to_plan' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.guard_team_scoped_training_references() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS training_sessions_team_drill_guard ON public.training_sessions;
CREATE TRIGGER training_sessions_team_drill_guard BEFORE INSERT OR UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_team_scoped_training_references();
DROP TRIGGER IF EXISTS practice_plan_blocks_team_drill_guard ON public.practice_plan_blocks;
CREATE TRIGGER practice_plan_blocks_team_drill_guard BEFORE INSERT OR UPDATE ON public.practice_plan_blocks
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_team_scoped_training_references();
DROP TRIGGER IF EXISTS practice_tasks_plan_block_guard ON public.practice_tasks;
CREATE TRIGGER practice_tasks_plan_block_guard BEFORE INSERT OR UPDATE ON public.practice_tasks
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_team_scoped_training_references();
DROP TRIGGER IF EXISTS training_drills_reassignment_guard ON public.training_drills;
CREATE TRIGGER training_drills_reassignment_guard BEFORE UPDATE OF team_id,is_template ON public.training_drills
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_team_scoped_training_references();

ALTER TABLE public.tournament_matches VALIDATE CONSTRAINT tournament_matches_cycle_team_fk;
ALTER TABLE public.practice_plan_blocks VALIDATE CONSTRAINT practice_plan_blocks_plan_team_fk;
ALTER TABLE public.training_sessions VALIDATE CONSTRAINT training_sessions_plan_team_fk;
ALTER TABLE public.practice_tasks VALIDATE CONSTRAINT practice_tasks_plan_team_fk;
ALTER TABLE public.practice_tasks VALIDATE CONSTRAINT practice_tasks_block_team_fk;
ALTER TABLE public.practice_tasks VALIDATE CONSTRAINT practice_tasks_member_team_fk;
ALTER TABLE public.practice_tasks VALIDATE CONSTRAINT practice_tasks_source_session_team_fk;
ALTER TABLE public.training_session_participants VALIDATE CONSTRAINT training_session_participants_session_team_fk;
ALTER TABLE public.training_session_participants VALIDATE CONSTRAINT training_session_participants_member_team_fk;
ALTER TABLE public.training_results VALIDATE CONSTRAINT training_results_session_team_fk;
ALTER TABLE public.training_results VALIDATE CONSTRAINT training_results_member_team_fk;
ALTER TABLE public.scrim_team_reviews VALIDATE CONSTRAINT scrim_team_reviews_scrim_team_fk;
ALTER TABLE public.practice_plan_blocks VALIDATE CONSTRAINT practice_plan_blocks_linked_drill_fk;
ALTER TABLE public.scrim_records VALIDATE CONSTRAINT scrim_records_match_count_matches_array_check;

COMMENT ON INDEX public.training_results_session_attempt_without_player_uidx IS
  'Prevents duplicate session-level Training results for the same attempt when player_member_id is NULL.';
