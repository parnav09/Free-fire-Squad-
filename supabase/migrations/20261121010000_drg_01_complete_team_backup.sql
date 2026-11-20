-- DRG-01: complete, team-scoped, relationship-preserving backup/restore.
-- Depends on Evolution Phase 2.2-2.10 migrations. No production data is changed by this file.
-- All public team_id tables are discovered automatically; direct FK-only children are included too.
-- Immutable Evolution trigger history is preserved exactly through a private transaction capability.

CREATE TABLE IF NOT EXISTS evolution_private.team_backup_restore_capabilities (
  token uuid PRIMARY KEY,
  backend_pid integer NOT NULL,
  transaction_id xid8 NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT team_backup_restore_capability_tx_unique UNIQUE (backend_pid, transaction_id)
);
REVOKE ALL ON TABLE evolution_private.team_backup_restore_capabilities FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.is_team_backup_restore()
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM evolution_private.team_backup_restore_capabilities capability
    WHERE capability.backend_pid = pg_catalog.pg_backend_pid()
      AND capability.transaction_id = pg_catalog.pg_current_xact_id()
      AND capability.token = NULLIF(
        pg_catalog.current_setting('app.squad_os_backup_restore_token', true), ''
      )::uuid
  );
$function$;
REVOKE ALL ON FUNCTION evolution_private.is_team_backup_restore() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_action text := pg_catalog.current_setting('app.evolution_session_lifecycle_action', true);
  v_reason text := pg_catalog.current_setting('app.evolution_session_lifecycle_reason', true);
  v_cancel_code text := pg_catalog.current_setting('app.evolution_session_cancellation_code', true);
  v_actor uuid := auth.uid();
BEGIN
  IF evolution_private.is_team_backup_restore() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF ROW(
    NEW.lifecycle_status, NEW.lifecycle_version,
    NEW.lifecycle_scheduled_at, NEW.lifecycle_scheduled_by,
    NEW.started_at, NEW.started_by, NEW.awaiting_results_at, NEW.awaiting_results_by,
    NEW.results_verified_at, NEW.results_verified_by, NEW.closed_at, NEW.closed_by,
    NEW.cancelled_at, NEW.cancelled_by, NEW.cancellation_reason_code, NEW.cancellation_reason,
    NEW.archived_at, NEW.archived_by, NEW.archive_reason
  ) IS NOT DISTINCT FROM ROW(
    OLD.lifecycle_status, OLD.lifecycle_version,
    OLD.lifecycle_scheduled_at, OLD.lifecycle_scheduled_by,
    OLD.started_at, OLD.started_by, OLD.awaiting_results_at, OLD.awaiting_results_by,
    OLD.results_verified_at, OLD.results_verified_by, OLD.closed_at, OLD.closed_by,
    OLD.cancelled_at, OLD.cancelled_by, OLD.cancellation_reason_code, OLD.cancellation_reason,
    OLD.archived_at, OLD.archived_by, OLD.archive_reason
  ) THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL OR v_action NOT IN ('transition','reopen')
    OR NEW.lifecycle_status IS NOT DISTINCT FROM OLD.lifecycle_status
    OR NEW.lifecycle_version <> OLD.lifecycle_version + 1
    OR v_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(v_reason)) NOT BETWEEN 1 AND 500
  THEN
    RAISE EXCEPTION 'canonical_session_lifecycle_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = OLD.team_id AND tm.user_id = v_actor
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN
    RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;

  IF v_action = 'transition' THEN
    IF NOT (
      (OLD.lifecycle_status = 'draft' AND NEW.lifecycle_status = 'scheduled')
      OR (OLD.lifecycle_status = 'scheduled' AND NEW.lifecycle_status = 'in_progress')
      OR (OLD.lifecycle_status = 'in_progress' AND NEW.lifecycle_status = 'awaiting_results')
      OR (OLD.lifecycle_status = 'awaiting_results' AND NEW.lifecycle_status = 'verified')
      OR (OLD.lifecycle_status = 'verified' AND NEW.lifecycle_status = 'closed')
      OR (OLD.lifecycle_status IN ('draft','scheduled') AND NEW.lifecycle_status = 'cancelled')
      OR (OLD.lifecycle_status IN ('closed','cancelled') AND NEW.lifecycle_status = 'archived')
    ) THEN
      RAISE EXCEPTION 'invalid_canonical_session_transition' USING ERRCODE = '22023';
    END IF;
    IF NEW.lifecycle_status = 'verified' AND NOT EXISTS (
      SELECT 1 FROM public.canonical_session_result_submissions rs
      WHERE rs.canonical_session_id = OLD.id AND rs.team_id = OLD.team_id
    ) THEN
      RAISE EXCEPTION 'session_results_submission_required_before_verification' USING ERRCODE = '23514';
    END IF;
    IF NEW.lifecycle_status = 'closed' AND OLD.results_verified_at IS NULL THEN
      RAISE EXCEPTION 'verified_results_required_before_closure' USING ERRCODE = '23514';
    END IF;
    IF NEW.lifecycle_status = 'cancelled' THEN
      IF v_cancel_code IS NULL OR v_cancel_code NOT IN ('cancelled','no_show','other') THEN
        RAISE EXCEPTION 'cancellation_reason_code_required' USING ERRCODE = '22023';
      END IF;
      IF v_cancel_code = 'no_show' AND OLD.lifecycle_status <> 'scheduled' THEN
        RAISE EXCEPTION 'no_show_requires_scheduled_session' USING ERRCODE = '22023';
      END IF;
      NEW.cancelled_at := pg_catalog.clock_timestamp();
      NEW.cancelled_by := v_actor;
      NEW.cancellation_reason_code := v_cancel_code;
      NEW.cancellation_reason := pg_catalog.btrim(v_reason);
    END IF;
    IF NEW.lifecycle_status = 'scheduled' THEN
      NEW.lifecycle_scheduled_at := pg_catalog.clock_timestamp();
      NEW.lifecycle_scheduled_by := v_actor;
    ELSIF NEW.lifecycle_status = 'in_progress' THEN
      NEW.started_at := pg_catalog.clock_timestamp();
      NEW.started_by := v_actor;
    ELSIF NEW.lifecycle_status = 'awaiting_results' THEN
      NEW.awaiting_results_at := pg_catalog.clock_timestamp();
      NEW.awaiting_results_by := v_actor;
    ELSIF NEW.lifecycle_status = 'verified' THEN
      NEW.results_verified_at := pg_catalog.clock_timestamp();
      NEW.results_verified_by := v_actor;
    ELSIF NEW.lifecycle_status = 'closed' THEN
      NEW.closed_at := pg_catalog.clock_timestamp();
      NEW.closed_by := v_actor;
    ELSIF NEW.lifecycle_status = 'archived' THEN
      NEW.archived_at := pg_catalog.clock_timestamp();
      NEW.archived_by := v_actor;
      NEW.archive_reason := pg_catalog.btrim(v_reason);
      IF OLD.lifecycle_status = 'cancelled' THEN
        NEW.cancelled_at := NULL;
        NEW.cancelled_by := NULL;
        NEW.cancellation_reason_code := NULL;
        NEW.cancellation_reason := NULL;
      END IF;
    END IF;
  ELSE
    IF NOT (
      (OLD.lifecycle_status = 'closed' AND NEW.lifecycle_status = 'verified')
      OR (OLD.lifecycle_status = 'verified' AND NEW.lifecycle_status = 'awaiting_results')
      OR (OLD.lifecycle_status = 'archived' AND NEW.lifecycle_status = 'closed')
      OR (OLD.lifecycle_status = 'cancelled' AND NEW.lifecycle_status = 'scheduled')
    ) THEN
      RAISE EXCEPTION 'invalid_canonical_session_reopen' USING ERRCODE = '22023';
    END IF;
    IF OLD.lifecycle_status = 'verified' THEN
      NEW.results_verified_at := NULL;
      NEW.results_verified_by := NULL;
      NEW.awaiting_results_at := pg_catalog.clock_timestamp();
      NEW.awaiting_results_by := v_actor;
    ELSIF OLD.lifecycle_status = 'closed' THEN
      NEW.closed_at := NULL;
      NEW.closed_by := NULL;
    ELSIF OLD.lifecycle_status = 'archived' THEN
      NEW.archived_at := NULL;
      NEW.archived_by := NULL;
      NEW.archive_reason := NULL;
    ELSIF OLD.lifecycle_status = 'cancelled' THEN
      NEW.cancelled_at := NULL;
      NEW.cancelled_by := NULL;
      NEW.cancellation_reason_code := NULL;
      NEW.cancellation_reason := NULL;
      NEW.lifecycle_scheduled_at := pg_catalog.clock_timestamp();
      NEW.lifecycle_scheduled_by := v_actor;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_roster_header()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT'
    OR pg_catalog.current_setting('app.evolution_roster_action', true) IS DISTINCT FROM 'lock'
  THEN
    RAISE EXCEPTION 'canonical_session_roster_rpc_required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_roster_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF pg_catalog.current_setting('app.evolution_roster_action', true) IS DISTINCT FROM 'lock' THEN
      RAISE EXCEPTION 'canonical_session_roster_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF pg_catalog.current_setting('app.evolution_roster_action', true) IS DISTINCT FROM 'status'
      OR (pg_catalog.to_jsonb(NEW) - 'selection_status')
        IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - 'selection_status')
    THEN
      RAISE EXCEPTION 'canonical_session_roster_status_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_session_roster_is_non_destructive' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_match_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF pg_catalog.current_setting('app.evolution_participation_action', true) IS DISTINCT FROM 'record' THEN
      RAISE EXCEPTION 'canonical_match_participation_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF pg_catalog.current_setting('app.evolution_participation_action', true) IS DISTINCT FROM 'correct'
      OR (pg_catalog.to_jsonb(NEW) - 'participation_status')
        IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - 'participation_status')
    THEN
      RAISE EXCEPTION 'canonical_match_participation_correction_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_match_participation_is_non_destructive' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_team_role_definition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF pg_catalog.current_setting('app.evolution_role_definition_action', true) IS DISTINCT FROM 'save' THEN
      RAISE EXCEPTION 'canonical_team_role_definition_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF pg_catalog.current_setting('app.evolution_role_definition_action', true) IS DISTINCT FROM 'save'
      OR OLD.is_current IS DISTINCT FROM true OR NEW.is_current IS DISTINCT FROM false
      OR (pg_catalog.to_jsonb(NEW) - 'is_current') IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - 'is_current')
    THEN
      RAISE EXCEPTION 'canonical_team_role_definition_is_versioned' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_team_role_definition_is_non_destructive' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_match_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF pg_catalog.current_setting('app.evolution_role_action', true) IS DISTINCT FROM 'snapshot'
      AND pg_catalog.current_setting('app.evolution_role_action', true) IS DISTINCT FROM 'change' THEN
      RAISE EXCEPTION 'canonical_session_match_role_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF pg_catalog.current_setting('app.evolution_role_action', true) IS DISTINCT FROM 'change'
      OR (pg_catalog.to_jsonb(NEW) - ARRAY[
        'role_definition_id','role_key_snapshot','role_name_snapshot','role_description_snapshot',
        'role_definition_version_snapshot','role_assignment_status','effective_at',
        'effective_round_label','assignment_source','idempotency_key','changed_by','changed_at'
      ]) IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - ARRAY[
        'role_definition_id','role_key_snapshot','role_name_snapshot','role_description_snapshot',
        'role_definition_version_snapshot','role_assignment_status','effective_at',
        'effective_round_label','assignment_source','idempotency_key','changed_by','changed_at'
      ])
    THEN
      RAISE EXCEPTION 'canonical_session_match_role_change_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_session_match_role_is_non_destructive' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_substitution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND pg_catalog.current_setting('app.evolution_substitution_action', true) = 'record' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_session_substitution_is_append_only_rpc_required' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_substitution_role_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND pg_catalog.current_setting('app.evolution_substitution_role_transfer_action', true) = 'record' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_session_substitution_role_transfer_is_append_only_rpc_required' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_result_root()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP='INSERT' AND pg_catalog.current_setting('app.evolution_result_write',true)='root' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND pg_catalog.current_setting('app.evolution_result_write',true)='root' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'canonical_session_result_root_rpc_required' USING ERRCODE='42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_result_append()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP='INSERT' AND pg_catalog.current_setting('app.evolution_result_write',true)='append' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'canonical_session_result_history_is_append_only' USING ERRCODE='42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.audit_canonical_match_sequence_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN RETURN NEW; END IF;

  IF NEW.match_sequence IS DISTINCT FROM OLD.match_sequence THEN
    INSERT INTO public.canonical_session_match_sequence_events (
      team_id, canonical_session_match_id, previous_sequence, new_sequence, reason, changed_by
    )
    VALUES (
      NEW.team_id,
      NEW.id,
      OLD.match_sequence,
      NEW.match_sequence,
      coalesce(
        nullif(pg_catalog.btrim(pg_catalog.current_setting('app.evolution_match_sequence_reason', true)), ''),
        'Sequence corrected without supplied reason'
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION evolution_private.audit_canonical_match_sequence_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS canonical_session_match_sequence_audit
  ON public.canonical_session_matches;
CREATE TRIGGER canonical_session_match_sequence_audit
AFTER UPDATE OF match_sequence ON public.canonical_session_matches
FOR EACH ROW EXECUTE FUNCTION evolution_private.audit_canonical_match_sequence_change();

CREATE OR REPLACE FUNCTION public.correct_canonical_match_sequence(
  p_match_id uuid,
  p_new_sequence smallint,
  p_reason text
)
RETURNS public.canonical_session_matches
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_match public.canonical_session_matches;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'sequence_correction_reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match
  FROM public.canonical_session_matches
  WHERE id = p_match_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'canonical_match_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_match.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner', 'coach')
  ) THEN
    RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('app.evolution_match_sequence_reason', pg_catalog.btrim(p_reason), true);
  UPDATE public.canonical_session_matches
  SET match_sequence = p_new_sequence
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.audit_canonical_session_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF evolution_private.is_team_backup_restore() THEN RETURN NEW; END IF;

  INSERT INTO public.canonical_session_lifecycle_events (
    team_id, canonical_session_id, lifecycle_version, event_kind,
    previous_status, new_status, reason, cancellation_reason_code,
    idempotency_key, changed_by, changed_at
  ) VALUES (
    NEW.team_id, NEW.id, NEW.lifecycle_version,
    pg_catalog.current_setting('app.evolution_session_lifecycle_action', true),
    OLD.lifecycle_status, NEW.lifecycle_status,
    pg_catalog.current_setting('app.evolution_session_lifecycle_reason', true),
    CASE WHEN NEW.lifecycle_status = 'cancelled' THEN NEW.cancellation_reason_code ELSE NULL END,
    pg_catalog.current_setting('app.evolution_session_lifecycle_idempotency_key', true)::uuid,
    auth.uid(), pg_catalog.clock_timestamp()
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.audit_canonical_session_roster_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_key uuid;
  v_reason text;
BEGIN
  IF evolution_private.is_team_backup_restore() THEN RETURN NEW; END IF;

  v_key := NULLIF(pg_catalog.current_setting('app.evolution_roster_idempotency_key', true), '')::uuid;
  v_reason := NULLIF(pg_catalog.btrim(pg_catalog.current_setting('app.evolution_roster_reason', true)), '');
  IF v_key IS NULL OR v_reason IS NULL THEN
    RAISE EXCEPTION 'canonical_session_roster_audit_context_required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.canonical_session_roster_member_events(
    team_id, canonical_session_id, roster_member_id, event_kind,
    previous_status, new_status, reason, idempotency_key, changed_by
  ) VALUES (
    NEW.team_id, NEW.canonical_session_id, NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'snapshot' ELSE 'selection' END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.selection_status END,
    NEW.selection_status, v_reason, v_key, auth.uid()
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.audit_canonical_session_match_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_key uuid;
  v_reason text;
BEGIN
  IF evolution_private.is_team_backup_restore() THEN RETURN NEW; END IF;

  v_key := NULLIF(pg_catalog.current_setting('app.evolution_participation_idempotency_key', true), '')::uuid;
  v_reason := NULLIF(pg_catalog.btrim(pg_catalog.current_setting('app.evolution_participation_reason', true)), '');
  IF v_key IS NULL OR v_reason IS NULL THEN
    RAISE EXCEPTION 'canonical_match_participation_audit_context_required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.canonical_session_match_participation_events(
    team_id, canonical_session_id, participant_id, event_kind,
    previous_status, new_status, reason, idempotency_key, changed_by
  ) VALUES (
    NEW.team_id, NEW.canonical_session_id, NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'record' ELSE 'correction' END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.participation_status END,
    NEW.participation_status, v_reason, v_key, auth.uid()
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.audit_canonical_session_match_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_reason text;
BEGIN
  IF evolution_private.is_team_backup_restore() THEN RETURN NEW; END IF;

  v_reason := NULLIF(pg_catalog.btrim(pg_catalog.current_setting('app.evolution_role_reason', true)), '');
  IF v_reason IS NULL OR NEW.idempotency_key IS NULL THEN
    RAISE EXCEPTION 'canonical_session_match_role_audit_context_required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.canonical_session_match_role_events(
    team_id, canonical_session_id, canonical_session_match_id, role_assignment_id,
    roster_member_id, player_user_id, event_kind,
    previous_role_definition_id, previous_role_assignment_status, previous_role_key,
    previous_role_name, previous_role_description, previous_role_definition_version,
    new_role_definition_id, new_role_assignment_status, new_role_key, new_role_name,
    new_role_description, new_role_definition_version, effective_at,
    effective_round_label, reason, idempotency_key, changed_by
  ) VALUES (
    NEW.team_id, NEW.canonical_session_id, NEW.canonical_session_match_id, NEW.id,
    NEW.roster_member_id, NEW.player_user_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'snapshot' ELSE 'change' END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_definition_id END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_assignment_status END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_key_snapshot END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_name_snapshot END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_description_snapshot END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_definition_version_snapshot END,
    NEW.role_definition_id, NEW.role_assignment_status, NEW.role_key_snapshot,
    NEW.role_name_snapshot, NEW.role_description_snapshot, NEW.role_definition_version_snapshot,
    NEW.effective_at, NEW.effective_round_label, v_reason, NEW.idempotency_key, NEW.changed_by
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.snapshot_canonical_session_roster_member_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_assigned_role text;
  v_definition public.canonical_team_role_definitions;
BEGIN
  IF evolution_private.is_team_backup_restore() THEN RETURN NEW; END IF;

  SELECT tm.assigned_role INTO v_assigned_role
  FROM public.team_members tm
  WHERE tm.id = NEW.membership_id_snapshot
    AND tm.team_id = NEW.team_id
    AND tm.user_id = NEW.player_user_id
    AND tm.status = 'active';

  NEW.role_definition_id_snapshot := NULL;
  NEW.role_key_snapshot := NULL;
  NEW.role_name_snapshot := NULL;
  NEW.role_description_snapshot := NULL;
  NEW.role_definition_version_snapshot := NULL;

  IF v_assigned_role IS NULL OR char_length(pg_catalog.btrim(v_assigned_role)) = 0 THEN
    NEW.role_assignment_status_snapshot := 'unknown';
    RETURN NEW;
  END IF;

  SELECT * INTO v_definition
  FROM public.canonical_team_role_definitions d
  WHERE d.team_id = NEW.team_id
    AND d.role_key = pg_catalog.lower(pg_catalog.btrim(v_assigned_role))
    AND d.is_current
  FOR SHARE;

  IF NOT FOUND THEN
    NEW.role_assignment_status_snapshot := 'unmapped';
    NEW.role_name_snapshot := pg_catalog.btrim(v_assigned_role);
    RETURN NEW;
  END IF;

  NEW.role_definition_id_snapshot := v_definition.id;
  NEW.role_key_snapshot := v_definition.role_key;
  NEW.role_name_snapshot := v_definition.role_name;
  NEW.role_description_snapshot := v_definition.role_description;
  NEW.role_definition_version_snapshot := v_definition.definition_version;
  NEW.role_assignment_status_snapshot := CASE WHEN v_definition.is_active THEN 'assigned' ELSE 'retired' END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.snapshot_canonical_session_match_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_member public.canonical_session_roster_members;
  v_match public.canonical_session_matches;
  v_key uuid;
  v_effective_at timestamptz;
BEGIN
  IF evolution_private.is_team_backup_restore() THEN RETURN NEW; END IF;

  IF NEW.participation_status <> 'participated' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.canonical_session_match_roles
    WHERE canonical_session_match_id = NEW.canonical_session_match_id
      AND roster_member_id = NEW.roster_member_id
  ) THEN RETURN NEW; END IF;
  SELECT * INTO v_member FROM public.canonical_session_roster_members
  WHERE id = NEW.roster_member_id
    AND team_id = NEW.team_id
    AND canonical_session_id = NEW.canonical_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'canonical_session_match_role_roster_snapshot_missing' USING ERRCODE = '23503';
  END IF;
  SELECT * INTO v_match FROM public.canonical_session_matches
  WHERE id = NEW.canonical_session_match_id
    AND team_id = NEW.team_id
    AND canonical_session_id = NEW.canonical_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'canonical_session_match_role_match_missing' USING ERRCODE = '23503';
  END IF;

  v_key := NULLIF(pg_catalog.current_setting('app.evolution_participation_idempotency_key', true), '')::uuid;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'canonical_session_match_role_participation_context_missing' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT e.changed_at INTO v_effective_at
    FROM public.canonical_session_match_participation_events e
    WHERE e.participant_id = NEW.id
    ORDER BY e.changed_at DESC LIMIT 1;
  ELSE
    v_effective_at := NEW.recorded_at;
  END IF;
  IF v_effective_at IS NULL THEN
    RAISE EXCEPTION 'canonical_session_match_role_effective_time_missing' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.set_config('app.evolution_role_action','snapshot',true);
  PERFORM pg_catalog.set_config('app.evolution_role_reason','Captured from immutable session roster role snapshot when participation was recorded or corrected to participated.',true);

  INSERT INTO public.canonical_session_match_roles(
    team_id, canonical_session_id, canonical_session_match_id, roster_member_id,
    player_user_id, role_definition_id, role_key_snapshot, role_name_snapshot,
    role_description_snapshot, role_definition_version_snapshot, role_assignment_status,
    effective_at, effective_round_label, assignment_source, idempotency_key, changed_by, changed_at
  ) VALUES (
    NEW.team_id, NEW.canonical_session_id, NEW.canonical_session_match_id, NEW.roster_member_id,
    NEW.player_user_id, v_member.role_definition_id_snapshot, v_member.role_key_snapshot,
    v_member.role_name_snapshot, v_member.role_description_snapshot,
    v_member.role_definition_version_snapshot, v_member.role_assignment_status_snapshot,
    v_effective_at, v_match.round_label, 'session_snapshot', v_key, auth.uid(), clock_timestamp()
  )
  ON CONFLICT (canonical_session_match_id, player_user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.team_backup_table_names()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH scoped AS (
    SELECT c.oid, c.relname
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r','p')
      AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = c.oid AND a.attname = 'team_id'
          AND a.attnum > 0 AND NOT a.attisdropped
      )
  ),
  direct_children AS (
    SELECT DISTINCT child.relname
    FROM pg_catalog.pg_constraint fk
    JOIN pg_catalog.pg_class child ON child.oid = fk.conrelid
    JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN scoped parent ON parent.oid = fk.confrelid
    WHERE fk.contype = 'f'
      AND child_ns.nspname = 'public'
      AND child.relkind IN ('r','p')
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = child.oid AND a.attname = 'team_id'
          AND a.attnum > 0 AND NOT a.attisdropped
      )
  )
  SELECT COALESCE(
    pg_catalog.array_agg(name ORDER BY name),
    ARRAY[]::text[]
  )
  FROM (
    SELECT relname AS name FROM scoped
    UNION
    SELECT relname AS name FROM direct_children
  ) inventory;
$function$;
REVOKE ALL ON FUNCTION evolution_private.team_backup_table_names() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.team_backup_scope_predicate(p_table text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_has_team_id boolean;
  v_predicate text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public' AND c.relname = p_table
      AND a.attname = 'team_id' AND a.attnum > 0 AND NOT a.attisdropped
  ) INTO v_has_team_id;

  IF v_has_team_id THEN
    RETURN 'x.team_id = $1';
  END IF;

  SELECT pg_catalog.string_agg(
    pg_catalog.format(
      'EXISTS (SELECT 1 FROM public.%I p WHERE %s AND p.team_id = $1)',
      parent.relname,
      join_columns.join_sql
    ),
    ' AND ' ORDER BY parent.relname, fk.conname
  )
  INTO v_predicate
  FROM pg_catalog.pg_constraint fk
  JOIN pg_catalog.pg_class child ON child.oid = fk.conrelid
  JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid = child.relnamespace
  JOIN pg_catalog.pg_class parent ON parent.oid = fk.confrelid
  JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
  JOIN LATERAL (
    SELECT pg_catalog.string_agg(
      pg_catalog.format('x.%I = p.%I', child_col.attname, parent_col.attname),
      ' AND ' ORDER BY child_key.ordinality
    ) AS join_sql
    FROM unnest(fk.conkey) WITH ORDINALITY AS child_key(attnum, ordinality)
    JOIN unnest(fk.confkey) WITH ORDINALITY AS parent_key(attnum, ordinality)
      ON parent_key.ordinality = child_key.ordinality
    JOIN pg_catalog.pg_attribute child_col
      ON child_col.attrelid = fk.conrelid AND child_col.attnum = child_key.attnum
    JOIN pg_catalog.pg_attribute parent_col
      ON parent_col.attrelid = fk.confrelid AND parent_col.attnum = parent_key.attnum
  ) join_columns ON join_columns.join_sql IS NOT NULL
  WHERE fk.contype = 'f'
    AND child_ns.nspname = 'public'
    AND child.relname = p_table
    AND parent_ns.nspname = 'public'
    AND EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = parent.oid AND a.attname = 'team_id'
        AND a.attnum > 0 AND NOT a.attisdropped
    );

  RETURN v_predicate;
END;
$function$;
REVOKE ALL ON FUNCTION evolution_private.team_backup_scope_predicate(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.team_backup_unsupported_child_tables(p_included text[])
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH RECURSIVE edges AS (
    SELECT parent.relname AS parent_name, child.relname AS child_name,
           child.oid AS child_oid
    FROM pg_catalog.pg_constraint fk
    JOIN pg_catalog.pg_class child ON child.oid = fk.conrelid
    JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_catalog.pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    WHERE fk.contype = 'f'
      AND child_ns.nspname = 'public'
      AND parent_ns.nspname = 'public'
      AND child.relkind IN ('r','p')
  ),
  walk AS (
    SELECT e.child_name, ARRAY[e.parent_name,e.child_name]::text[] AS path
    FROM edges e
    WHERE e.parent_name = ANY(p_included)
    UNION ALL
    SELECT e.child_name, w.path || e.child_name
    FROM walk w
    JOIN edges e ON e.parent_name = w.child_name
    WHERE NOT e.child_name = ANY(w.path)
  )
  SELECT COALESCE(
    pg_catalog.array_agg(DISTINCT w.child_name ORDER BY w.child_name),
    ARRAY[]::text[]
  )
  FROM walk w
  WHERE NOT w.child_name = ANY(p_included)
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'public' AND c.relname = w.child_name
        AND a.attname = 'team_id' AND a.attnum > 0 AND NOT a.attisdropped
    );
$function$;
REVOKE ALL ON FUNCTION evolution_private.team_backup_unsupported_child_tables(text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.team_backup_schema_fingerprint(p_tables text[])
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_columns text;
  v_constraints text;
BEGIN
  SELECT COALESCE(
    pg_catalog.string_agg(
      pg_catalog.format('%s:%s:%s:%s', child.relname, constraint_row.conname,
        constraint_row.contype, pg_catalog.pg_get_constraintdef(constraint_row.oid)),
      E'\\n' ORDER BY child.relname, constraint_row.conname
    ), ''
  )
  INTO v_constraints
  FROM pg_catalog.pg_constraint constraint_row
  JOIN pg_catalog.pg_class child ON child.oid = constraint_row.conrelid
  JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid = child.relnamespace
  WHERE child_ns.nspname = 'public'
    AND child.relname = ANY(p_tables)
    AND constraint_row.contype IN ('p','u','f','c','x');

  RETURN pg_catalog.md5(v_columns || E'\n' || v_constraints);
END;
$function$;
REVOKE ALL ON FUNCTION evolution_private.team_backup_schema_fingerprint(text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_team_backup_for_team(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_team jsonb;
  v_tables jsonb := '{}'::jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_table text;
  v_rows jsonb;
  v_predicate text;
  v_table_names text[];
  v_exported_tables text[] := ARRAY[]::text[];
  v_missing_required text[];
  v_missing_canonical text[];
  v_missing_phase_three text[];
  v_unsupported text[];
  v_required_team text[] := ARRAY[
    'team_members','team_settings','team_join_requests','team_ratings',
    'team_data_retention_settings','daily_drills','daily_scores','daily_score_feedback',
    'player_drill_assignments','player_nicknames','player_character_loadouts',
    'training_log','training_session_notes','training_drills','practice_plans',
    'practice_plan_blocks','practice_tasks','practice_task_events','training_sessions',
    'training_session_participants','training_results','scrim_records','scrim_team_reviews',
    'tournament_cycles','tournament_matches'
  ];
  v_required_canonical text[] := ARRAY[
    'canonical_sessions','canonical_session_sources','canonical_session_match_sets',
    'canonical_session_matches','canonical_session_match_sequence_events',
    'canonical_session_lifecycle_events','canonical_session_result_submissions',
    'canonical_session_roster_policies','canonical_session_rosters',
    'canonical_session_roster_members','canonical_session_roster_member_events',
    'canonical_session_match_participants','canonical_session_match_participation_events',
    'canonical_team_role_definitions','canonical_team_role_definition_events',
    'canonical_session_match_roles','canonical_session_match_role_events',
    'canonical_session_substitutions','canonical_session_substitution_role_transfers',
    'canonical_session_results','canonical_session_result_versions','canonical_session_result_events'
  ];
  v_phase_three_candidate text[] := ARRAY[
    'evolution_rubric_versions','evolution_rubric_dimensions',
    'evolution_role_weight_profiles','evolution_evidence_items',
    'evolution_evidence_dimension_links'
  ];
  v_fingerprint text;
  v_total bigint := 0;
  v_complete boolean;
  v_phase_three_present boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_team_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.team_members tm ON tm.team_id = t.id
    WHERE t.id = p_team_id AND t.owner_id = v_user
      AND tm.user_id = v_user AND tm.status = 'active'
      AND tm.membership_role = 'owner'
  ) THEN
    RAISE EXCEPTION 'active_selected_team_owner_required' USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'id', t.id, 'team_name', t.team_name, 'team_description', t.team_description,
    'timezone', t.timezone, 'avatar_url', t.avatar_url,
    'created_at', t.created_at, 'owner_id', t.owner_id
  )
  INTO v_team
  FROM public.teams t WHERE t.id = p_team_id;

  v_table_names := evolution_private.team_backup_table_names();
  v_missing_required := ARRAY(
    SELECT expected FROM unnest(v_required_team) expected
    WHERE NOT expected = ANY(v_table_names)
    ORDER BY expected
  );
  v_missing_canonical := ARRAY(
    SELECT expected FROM unnest(v_required_canonical) expected
    WHERE NOT expected = ANY(v_table_names)
    ORDER BY expected
  );
  v_missing_phase_three := ARRAY(
    SELECT expected FROM unnest(v_phase_three_candidate) expected
    WHERE NOT expected = ANY(v_table_names)
    ORDER BY expected
  );
  v_unsupported := evolution_private.team_backup_unsupported_child_tables(v_table_names);
  v_phase_three_present := v_table_names && v_phase_three_candidate;
  v_fingerprint := evolution_private.team_backup_schema_fingerprint(v_table_names);

  FOREACH v_table IN ARRAY v_table_names LOOP
    v_predicate := evolution_private.team_backup_scope_predicate(v_table);
    IF v_predicate IS NULL THEN
      v_unsupported := pg_catalog.array_append(v_unsupported, v_table);
      CONTINUE;
    END IF;

    EXECUTE pg_catalog.format(
      'SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)), ''[]''::jsonb) FROM public.%I x WHERE %s',
      v_table, v_predicate
    ) INTO v_rows USING p_team_id;

    v_tables := v_tables || pg_catalog.jsonb_build_object(v_table, COALESCE(v_rows,'[]'::jsonb));
    v_counts := v_counts || pg_catalog.jsonb_build_object(v_table, pg_catalog.jsonb_array_length(COALESCE(v_rows,'[]'::jsonb)));
    v_exported_tables := pg_catalog.array_append(v_exported_tables, v_table);
    v_total := v_total + pg_catalog.jsonb_array_length(COALESCE(v_rows,'[]'::jsonb));
  END LOOP;

  v_complete := pg_catalog.cardinality(v_missing_required) = 0
    AND pg_catalog.cardinality(v_missing_canonical) = 0
    AND pg_catalog.cardinality(v_unsupported) = 0
    AND (NOT v_phase_three_present OR pg_catalog.cardinality(v_missing_phase_three) = 0)
    AND v_exported_tables = v_table_names;

  RETURN pg_catalog.jsonb_build_object(
    'format','squad-os-team-backup',
    'schema_version',2,
    'created_at',pg_catalog.clock_timestamp(),
    'exported_at',pg_catalog.clock_timestamp(),
    'team',v_team,
    'tables',v_tables,
    'coverage_report',pg_catalog.jsonb_build_object(
      'complete',v_complete,
      'included_tables',pg_catalog.to_jsonb(v_exported_tables),
      'included_table_count',pg_catalog.cardinality(v_exported_tables),
      'row_counts',v_counts,
      'total_rows',v_total,
      'missing_required_tables',pg_catalog.to_jsonb(v_missing_required),
      'missing_canonical_evolution_tables',pg_catalog.to_jsonb(v_missing_canonical),
      'unsupported_child_tables',pg_catalog.to_jsonb(v_unsupported),
      'schema_fingerprint',v_fingerprint,
      'phase_three_schema_present',v_phase_three_present,
      'known_phase_three_candidate_tables',pg_catalog.to_jsonb(v_phase_three_candidate),
      'missing_phase_three_candidate_tables',pg_catalog.to_jsonb(v_missing_phase_three),
      'unpersisted_capabilities',pg_catalog.to_jsonb(ARRAY[
        'The inspected Phase 3 candidate does not yet persist immutable computed-score snapshots as a dedicated durable record; only rubric/evidence inputs are present.'
      ]),
      'excluded_sources',pg_catalog.to_jsonb(ARRAY[
        'auth.users: authentication accounts and credentials remain external identities.',
        'profiles: global account profile data, not team-owned.',
        'character_profiles: shared global game catalogue.',
        'data_retention_settings: global platform policy; team_data_retention_settings is included.',
        'account_recovery_otps and recovery_email_enrollment_otps: security secrets are never exported.',
        'storage.objects: team logo is embedded separately by the client when within the 5 MB limit; avatar_url remains in team metadata.',
        'training_drills rows with team_id NULL: shared global templates are not team-owned.'
      ])
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_team_backup_for_team(p_backup jsonb, p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_backup_team_id uuid;
  v_backup_owner uuid;
  v_owner_row jsonb;
  v_tables jsonb;
  v_current_tables text[];
  v_backup_tables text[];
  v_payload_tables text[];
  v_insert_order text[];
  v_delete_order text[];
  v_table text;
  v_rows jsonb;
  v_row jsonb;
  v_predicate text;
  v_columns text;
  v_expressions text;
  v_update_columns text;
  v_update_row_count bigint;
  v_row_count integer;
  v_expected_count integer;
  v_restored_rows bigint := 0;
  v_restored_tables text[] := ARRAY[]::text[];
  v_has_cycle boolean := false;
  v_has_team_id boolean;
  v_unknown_column boolean;
  v_missing_required_column boolean;
  v_fingerprint text;
  v_token uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_team_id IS NULL OR p_backup->>'format' IS DISTINCT FROM 'squad-os-team-backup'
    OR (p_backup->>'schema_version')::integer IS DISTINCT FROM 2
  THEN
    RAISE EXCEPTION 'unsupported_or_invalid_backup_version_2_required' USING ERRCODE = '22023';
  END IF;
  IF COALESCE((p_backup->'coverage_report'->>'complete')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'backup_is_incomplete_export_a_complete_backup_before_restore' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.teams t
  JOIN public.team_members tm ON tm.team_id = t.id
  WHERE t.id = p_team_id AND t.owner_id = v_user
    AND tm.user_id = v_user AND tm.status = 'active'
    AND tm.membership_role = 'owner'
  FOR UPDATE OF t;
  IF NOT FOUND THEN RAISE EXCEPTION 'active_selected_team_owner_required' USING ERRCODE = '42501'; END IF;

  v_backup_team_id := NULLIF(p_backup->'team'->>'id','')::uuid;
  v_backup_owner := NULLIF(p_backup->'team'->>'owner_id','')::uuid;
  IF v_backup_team_id IS NULL OR v_backup_owner IS NULL THEN
    RAISE EXCEPTION 'backup_team_identity_missing' USING ERRCODE = '22023';
  END IF;

  v_tables := p_backup->'tables';
  IF pg_catalog.jsonb_typeof(v_tables) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'backup_tables_object_missing' USING ERRCODE = '22023';
  END IF;

  v_current_tables := evolution_private.team_backup_table_names();
  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY[
      'team_members','team_settings','team_join_requests','team_ratings',
      'team_data_retention_settings','daily_drills','daily_scores','daily_score_feedback',
      'player_drill_assignments','player_nicknames','player_character_loadouts',
      'training_log','training_session_notes','training_drills','practice_plans',
      'practice_plan_blocks','practice_tasks','practice_task_events','training_sessions',
      'training_session_participants','training_results','scrim_records','scrim_team_reviews',
      'tournament_cycles','tournament_matches',
      'canonical_sessions','canonical_session_sources','canonical_session_match_sets',
      'canonical_session_matches','canonical_session_match_sequence_events',
      'canonical_session_lifecycle_events','canonical_session_result_submissions',
      'canonical_session_roster_policies','canonical_session_rosters',
      'canonical_session_roster_members','canonical_session_roster_member_events',
      'canonical_session_match_participants','canonical_session_match_participation_events',
      'canonical_team_role_definitions','canonical_team_role_definition_events',
      'canonical_session_match_roles','canonical_session_match_role_events',
      'canonical_session_substitutions','canonical_session_substitution_role_transfers',
      'canonical_session_results','canonical_session_result_versions','canonical_session_result_events'
    ]::text[]) required(table_name)
    WHERE NOT required.table_name = ANY(v_current_tables)
  ) THEN
    RAISE EXCEPTION 'current_schema_missing_required_backup_tables_export_not_complete' USING ERRCODE = '22023';
  END IF;
  v_backup_tables := ARRAY(
    SELECT included.value
    FROM pg_catalog.jsonb_array_elements_text(p_backup->'coverage_report'->'included_tables') AS included(value)
    ORDER BY included.value
  );
  v_payload_tables := ARRAY(
    SELECT payload.key
    FROM pg_catalog.jsonb_object_keys(v_tables) AS payload(key)
    ORDER BY payload.key
  );
  IF v_backup_tables IS DISTINCT FROM v_current_tables
    OR v_payload_tables IS DISTINCT FROM v_current_tables
  THEN
    RAISE EXCEPTION 'backup_schema_table_set_mismatch_export_a_new_backup' USING ERRCODE = '22023';
  END IF;

  IF pg_catalog.cardinality(evolution_private.team_backup_unsupported_child_tables(v_current_tables)) > 0 THEN
    RAISE EXCEPTION 'unsupported_team_child_table_blocks_safe_restore' USING ERRCODE = '22023';
  END IF;

  v_fingerprint := evolution_private.team_backup_schema_fingerprint(v_current_tables);
  IF p_backup->'coverage_report'->>'schema_fingerprint' IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION 'backup_schema_fingerprint_mismatch_export_a_new_backup' USING ERRCODE = '22023';
  END IF;

  IF pg_catalog.jsonb_typeof(v_tables->'team_members') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'backup_roster_missing' USING ERRCODE = '22023';
  END IF;
  SELECT roster.value INTO v_owner_row
  FROM pg_catalog.jsonb_array_elements(v_tables->'team_members') AS roster(value)
  WHERE roster.value->>'membership_role' = 'owner'
    AND roster.value->>'user_id' = v_backup_owner::text
  LIMIT 1;
  IF v_owner_row IS NULL OR (
    SELECT count(*) FROM pg_catalog.jsonb_array_elements(v_tables->'team_members') AS roster(value)
    WHERE roster.value->>'membership_role' = 'owner'
      AND roster.value->>'user_id' = v_backup_owner::text
  ) <> 1 THEN
    RAISE EXCEPTION 'backup_must_contain_exactly_one_original_owner_membership' USING ERRCODE = '22023';
  END IF;

  -- Validate every payload array, count, source team and column before the first delete.
  FOREACH v_table IN ARRAY v_current_tables LOOP
    v_rows := v_tables->v_table;
    IF pg_catalog.jsonb_typeof(v_rows) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'backup_table_payload_invalid:%',v_table USING ERRCODE = '22023';
    END IF;
    v_expected_count := NULLIF(p_backup->'coverage_report'->'row_counts'->>v_table,'')::integer;
    IF v_expected_count IS NULL OR pg_catalog.jsonb_array_length(v_rows) <> v_expected_count THEN
      RAISE EXCEPTION 'backup_row_count_mismatch:%',v_table USING ERRCODE = '22023';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname='public' AND c.relname=v_table
        AND a.attname='team_id' AND a.attnum>0 AND NOT a.attisdropped
    ) INTO v_has_team_id;

    FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(v_rows) LOOP
      IF v_has_team_id AND NULLIF(v_row->>'team_id','')::uuid IS DISTINCT FROM v_backup_team_id THEN
        RAISE EXCEPTION 'cross_team_row_detected_in_backup:%',v_table USING ERRCODE = '22023';
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_object_keys(v_row) AS payload(key)
        WHERE NOT EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema='public' AND c.table_name=v_table AND c.column_name=payload.key
        )
      ) INTO v_unknown_column;
      IF v_unknown_column THEN
        RAISE EXCEPTION 'backup_contains_unknown_column:%',v_table USING ERRCODE = '22023';
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema='public' AND c.table_name=v_table
          AND c.is_nullable='NO' AND c.column_default IS NULL
          AND c.is_generated='NEVER'
          AND NOT (v_row ? c.column_name)
      ) INTO v_missing_required_column;
      IF v_missing_required_column THEN
        RAISE EXCEPTION 'backup_missing_required_column:%',v_table USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;

  -- Calculate dependency order from actual foreign keys. Cycles fail closed before deletion.
  WITH RECURSIVE edges AS (
    SELECT child.relname AS child_name, parent.relname AS parent_name
    FROM pg_catalog.pg_constraint fk
    JOIN pg_catalog.pg_class child ON child.oid=fk.conrelid
    JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid=child.relnamespace
    JOIN pg_catalog.pg_class parent ON parent.oid=fk.confrelid
    JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
    WHERE fk.contype='f' AND child_ns.nspname='public' AND parent_ns.nspname='public'
      AND child.relname=ANY(v_current_tables) AND parent.relname=ANY(v_current_tables)
  ),
  walk AS (
    SELECT table_name AS node, ARRAY[table_name]::text[] AS path, false AS cycle
    FROM unnest(v_current_tables) AS selected(table_name)
    UNION ALL
    SELECT e.child_name, w.path || e.child_name, e.child_name=ANY(w.path)
    FROM walk w JOIN edges e ON e.parent_name=w.node
    WHERE NOT w.cycle
  )
  SELECT EXISTS(SELECT 1 FROM walk WHERE cycle) INTO v_has_cycle;

  IF v_has_cycle THEN
    RAISE EXCEPTION 'team_backup_foreign_key_cycle_blocks_dependency_safe_restore' USING ERRCODE = '22023';
  END IF;

  WITH RECURSIVE edges AS (
    SELECT child.relname AS child_name, parent.relname AS parent_name
    FROM pg_catalog.pg_constraint fk
    JOIN pg_catalog.pg_class child ON child.oid=fk.conrelid
    JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid=child.relnamespace
    JOIN pg_catalog.pg_class parent ON parent.oid=fk.confrelid
    JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
    WHERE fk.contype='f' AND child_ns.nspname='public' AND parent_ns.nspname='public'
      AND child.relname=ANY(v_current_tables) AND parent.relname=ANY(v_current_tables)
  ),
  walk AS (
    SELECT table_name AS node, 0 AS depth, ARRAY[table_name]::text[] AS path
    FROM unnest(v_current_tables) AS selected(table_name)
    UNION ALL
    SELECT e.child_name, w.depth+1, w.path || e.child_name
    FROM walk w JOIN edges e ON e.parent_name=w.node
    WHERE NOT e.child_name=ANY(w.path)
  ),
  depths AS (SELECT node, max(depth) AS depth FROM walk GROUP BY node)
  SELECT pg_catalog.array_agg(node ORDER BY depth ASC,node) INTO v_insert_order FROM depths;

  SELECT pg_catalog.array_agg(node ORDER BY depth DESC,node) INTO v_delete_order
  FROM (
    WITH RECURSIVE edges AS (
      SELECT child.relname AS child_name, parent.relname AS parent_name
      FROM pg_catalog.pg_constraint fk
      JOIN pg_catalog.pg_class child ON child.oid=fk.conrelid
      JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid=child.relnamespace
      JOIN pg_catalog.pg_class parent ON parent.oid=fk.confrelid
      JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
      WHERE fk.contype='f' AND child_ns.nspname='public' AND parent_ns.nspname='public'
        AND child.relname=ANY(v_current_tables) AND parent.relname=ANY(v_current_tables)
    ),
    walk AS (
      SELECT table_name AS node, 0 AS depth, ARRAY[table_name]::text[] AS path
      FROM unnest(v_current_tables) AS selected(table_name)
      UNION ALL
      SELECT e.child_name, w.depth+1, w.path || e.child_name
      FROM walk w JOIN edges e ON e.parent_name=w.node
      WHERE NOT e.child_name=ANY(w.path)
    )
    SELECT node, max(depth) AS depth FROM walk GROUP BY node
  ) ordered_tables;

  -- A private, one-transaction capability is required to pass append-only Evolution guards.
  v_token := pg_catalog.gen_random_uuid();
  INSERT INTO evolution_private.team_backup_restore_capabilities(token,backend_pid,transaction_id)
  VALUES (v_token,pg_catalog.pg_backend_pid(),pg_catalog.pg_current_xact_id());
  PERFORM pg_catalog.set_config('app.squad_os_backup_restore_token',v_token::text,true);

  FOREACH v_table IN ARRAY v_delete_order LOOP
    IF v_table='team_members' THEN
      EXECUTE 'DELETE FROM public.team_members WHERE team_id=$1 AND user_id<>$2'
        USING p_team_id,v_user;
    ELSE
      v_predicate := evolution_private.team_backup_scope_predicate(v_table);
      IF v_predicate IS NULL THEN RAISE EXCEPTION 'restore_scope_unavailable:%',v_table; END IF;
      EXECUTE pg_catalog.format('DELETE FROM public.%I x WHERE %s',v_table,v_predicate)
        USING p_team_id;
    END IF;
  END LOOP;

  -- Preserve the target team's owner account while restoring the original membership UUID and fields.
  v_owner_row := pg_catalog.jsonb_set(v_owner_row,'{team_id}',pg_catalog.to_jsonb(p_team_id::text),true);
  v_owner_row := pg_catalog.jsonb_set(v_owner_row,'{user_id}',pg_catalog.to_jsonb(v_user::text),true);
  v_owner_row := pg_catalog.jsonb_set(v_owner_row,'{membership_role}',pg_catalog.to_jsonb('owner'::text),true);
  v_owner_row := pg_catalog.jsonb_set(v_owner_row,'{status}',pg_catalog.to_jsonb('active'::text),true);

  SELECT pg_catalog.string_agg(pg_catalog.format('%I',c.column_name),', ' ORDER BY c.ordinal_position)
  INTO v_update_columns
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='team_members'
    AND c.is_generated='NEVER';

  EXECUTE pg_catalog.format(
    'UPDATE public.team_members target SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.team_members,$1)) WHERE target.team_id=$2 AND target.user_id=$3',
    v_update_columns,v_update_columns
  ) USING v_owner_row,p_team_id,v_user;
  GET DIAGNOSTICS v_update_row_count = ROW_COUNT;
  IF v_update_row_count <> 1 THEN
    RAISE EXCEPTION 'current_owner_membership_restore_failed' USING ERRCODE = '23503';
  END IF;
  v_restored_rows := v_restored_rows + 1;

  FOREACH v_table IN ARRAY v_insert_order LOOP
    v_rows := v_tables->v_table;
    v_restored_tables := pg_catalog.array_append(v_restored_tables,v_table);
    FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(v_rows) LOOP
      IF v_table='team_members' AND v_row->>'membership_role'='owner'
        AND v_row->>'user_id'=v_backup_owner::text THEN
        CONTINUE;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
        WHERE n.nspname='public' AND c.relname=v_table
          AND a.attname='team_id' AND a.attnum>0 AND NOT a.attisdropped
      ) INTO v_has_team_id;
      IF v_has_team_id THEN
        v_row := pg_catalog.jsonb_set(v_row,'{team_id}',pg_catalog.to_jsonb(p_team_id::text),true);
      END IF;

      IF v_table='team_settings' AND v_row->>'setting_key'='igl_user_id'
        AND v_row->'setting_value'=pg_catalog.to_jsonb(v_backup_owner::text) THEN
        v_row := pg_catalog.jsonb_set(v_row,'{setting_value}',pg_catalog.to_jsonb(v_user::text),true);
      END IF;

      SELECT
        pg_catalog.string_agg(pg_catalog.format('%I',c.column_name),', ' ORDER BY c.ordinal_position),
        pg_catalog.string_agg(
          pg_catalog.format('(jsonb_populate_record(NULL::public.%I,$1)).%I',v_table,c.column_name),
          ', ' ORDER BY c.ordinal_position
        )
      INTO v_columns,v_expressions
      FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=v_table
        AND c.is_generated='NEVER' AND (v_row ? c.column_name);

      IF v_columns IS NULL OR v_expressions IS NULL THEN
        RAISE EXCEPTION 'backup_row_has_no_insertable_columns:%',v_table USING ERRCODE = '22023';
      END IF;

      EXECUTE pg_catalog.format(
        'INSERT INTO public.%I (%s) OVERRIDING SYSTEM VALUE SELECT %s',
        v_table,v_columns,v_expressions
      ) USING v_row;
      v_restored_rows := v_restored_rows + 1;
    END LOOP;
  END LOOP;

  UPDATE public.teams
  SET team_name = COALESCE(NULLIF(p_backup->'team'->>'team_name',''),team_name),
      team_description = p_backup->'team'->>'team_description',
      timezone = COALESCE(NULLIF(p_backup->'team'->>'timezone',''),timezone),
      avatar_url = p_backup->'team'->>'avatar_url',
      deletion_scheduled_at = NULL,
      deletion_reason = NULL,
      updated_at = pg_catalog.clock_timestamp()
  WHERE id=p_team_id;

  DELETE FROM evolution_private.team_backup_restore_capabilities WHERE token=v_token;
  PERFORM pg_catalog.set_config('app.squad_os_backup_restore_token','',true);

  RETURN pg_catalog.jsonb_build_object(
    'team_id',p_team_id,
    'restored_rows',v_restored_rows,
    'restored_tables',pg_catalog.to_jsonb(v_restored_tables),
    'schema_fingerprint',v_fingerprint,
    'complete',true,
    'owner_identity_remapped',v_backup_owner IS DISTINCT FROM v_user,
    'restored_at',pg_catalog.clock_timestamp()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_team_backup_for_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_backup_for_team(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.restore_team_backup_for_team(jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_team_backup_for_team(jsonb,uuid) TO authenticated;

-- The old unscoped endpoints are retired. Version 1 backups cannot safely restore the expanded graph.
REVOKE ALL ON FUNCTION public.get_team_backup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_team_backup(jsonb) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.get_team_backup_for_team(uuid) IS
  'Exports every team_id table plus direct FK-only children, with schema fingerprint, exact row counts and an explicit completeness report. Version 2.';
COMMENT ON FUNCTION public.restore_team_backup_for_team(jsonb,uuid) IS
  'Owner-only atomic replace restore. Preserves original IDs and FK graph; restores append-only Evolution history only through a private transaction capability. Version 2.';
