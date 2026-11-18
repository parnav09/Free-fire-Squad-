-- Evolution Phase Two.4 — Canonical Session Lifecycle
-- Additive only. Existing sessions start in Draft; source rows and match identities are untouched.
-- This migration is for isolated development/CI only until Point 2.9 rollout gate is cleared.

ALTER TABLE public.canonical_sessions
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS lifecycle_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifecycle_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS lifecycle_scheduled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS awaiting_results_at timestamptz,
  ADD COLUMN IF NOT EXISTS awaiting_results_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS results_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS results_verified_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cancellation_reason_code text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Preserve any pre-existing soft-archive state using only explicit legacy archive
-- metadata. Do not invent a prior status or synthetic lifecycle audit event.
UPDATE public.canonical_sessions
SET lifecycle_status = 'archived'
WHERE archived_at IS NOT NULL AND lifecycle_status = 'draft';

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canonical_sessions_lifecycle_status_check') THEN
    ALTER TABLE public.canonical_sessions ADD CONSTRAINT canonical_sessions_lifecycle_status_check
      CHECK (lifecycle_status IN ('draft','scheduled','in_progress','awaiting_results','verified','closed','cancelled','archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canonical_sessions_lifecycle_version_check') THEN
    ALTER TABLE public.canonical_sessions ADD CONSTRAINT canonical_sessions_lifecycle_version_check
      CHECK (lifecycle_version >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canonical_sessions_lifecycle_scheduled_pair') THEN
    ALTER TABLE public.canonical_sessions ADD CONSTRAINT canonical_sessions_lifecycle_scheduled_pair
      CHECK ((lifecycle_scheduled_at IS NULL) = (lifecycle_scheduled_by IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canonical_sessions_started_pair') THEN
    ALTER TABLE public.canonical_sessions ADD CONSTRAINT canonical_sessions_started_pair
      CHECK ((started_at IS NULL) = (started_by IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canonical_sessions_awaiting_results_pair') THEN
    ALTER TABLE public.canonical_sessions ADD CONSTRAINT canonical_sessions_awaiting_results_pair
      CHECK ((awaiting_results_at IS NULL) = (awaiting_results_by IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canonical_sessions_results_verified_pair') THEN
    ALTER TABLE public.canonical_sessions ADD CONSTRAINT canonical_sessions_results_verified_pair
      CHECK ((results_verified_at IS NULL) = (results_verified_by IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canonical_sessions_closed_pair') THEN
    ALTER TABLE public.canonical_sessions ADD CONSTRAINT canonical_sessions_closed_pair
      CHECK ((closed_at IS NULL) = (closed_by IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canonical_sessions_cancelled_pair') THEN
    ALTER TABLE public.canonical_sessions ADD CONSTRAINT canonical_sessions_cancelled_pair
      CHECK ((cancelled_at IS NULL) = (cancelled_by IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canonical_sessions_cancellation_shape') THEN
    ALTER TABLE public.canonical_sessions ADD CONSTRAINT canonical_sessions_cancellation_shape
      CHECK (
        (lifecycle_status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
          AND cancellation_reason_code IN ('cancelled','no_show','other')
          AND cancellation_reason IS NOT NULL AND char_length(btrim(cancellation_reason)) BETWEEN 1 AND 500)
        OR
        (lifecycle_status <> 'cancelled' AND cancelled_at IS NULL AND cancelled_by IS NULL
          AND cancellation_reason_code IS NULL AND cancellation_reason IS NULL)
      );
  END IF;
END
$constraints$;

CREATE TABLE IF NOT EXISTS public.canonical_session_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  lifecycle_version integer NOT NULL CHECK (lifecycle_version > 0),
  event_kind text NOT NULL CHECK (event_kind IN ('transition','reopen')),
  previous_status text NOT NULL,
  new_status text NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  cancellation_reason_code text CHECK (cancellation_reason_code IS NULL OR cancellation_reason_code IN ('cancelled','no_show','other')),
  idempotency_key uuid NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_lifecycle_event_status_change CHECK (previous_status <> new_status),
  CONSTRAINT canonical_session_lifecycle_event_session_team_fk
    FOREIGN KEY (canonical_session_id, team_id)
    REFERENCES public.canonical_sessions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_lifecycle_event_version_unique UNIQUE (canonical_session_id, lifecycle_version),
  CONSTRAINT canonical_session_lifecycle_event_idempotency_unique UNIQUE (canonical_session_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS canonical_session_lifecycle_events_team_session_time_idx
  ON public.canonical_session_lifecycle_events(team_id, canonical_session_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS public.canonical_session_result_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_result_submission_session_team_fk
    FOREIGN KEY (canonical_session_id, team_id)
    REFERENCES public.canonical_sessions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_result_submission_one_per_session UNIQUE (canonical_session_id),
  CONSTRAINT canonical_session_result_submission_idempotency UNIQUE (canonical_session_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS canonical_session_result_submissions_team_idx
  ON public.canonical_session_result_submissions(team_id, canonical_session_id);

ALTER TABLE public.canonical_session_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_result_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS canonical_session_lifecycle_events_staff_read ON public.canonical_session_lifecycle_events;
CREATE POLICY canonical_session_lifecycle_events_staff_read
  ON public.canonical_session_lifecycle_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = canonical_session_lifecycle_events.team_id
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
      AND tm.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS canonical_session_result_submissions_staff_read ON public.canonical_session_result_submissions;
CREATE POLICY canonical_session_result_submissions_staff_read
  ON public.canonical_session_result_submissions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = canonical_session_result_submissions.team_id
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
      AND tm.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS canonical_session_result_submissions_staff_insert ON public.canonical_session_result_submissions;
CREATE POLICY canonical_session_result_submissions_staff_insert
  ON public.canonical_session_result_submissions FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.canonical_sessions cs
        ON cs.id = canonical_session_result_submissions.canonical_session_id
       AND cs.team_id = canonical_session_result_submissions.team_id
       AND cs.lifecycle_status = 'awaiting_results'
      WHERE tm.team_id = canonical_session_result_submissions.team_id
        AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
        AND tm.membership_role IN ('owner','coach')
    )
  );

-- Replace broad table UPDATE with explicit columns. Lifecycle columns remain writable
-- only through the guarded transition RPC contract and lifecycle trigger.
REVOKE UPDATE ON public.canonical_sessions FROM authenticated;
GRANT UPDATE (
  title, session_date, scheduled_at, season_label,
  lifecycle_status, lifecycle_version,
  lifecycle_scheduled_at, lifecycle_scheduled_by,
  started_at, started_by, awaiting_results_at, awaiting_results_by,
  results_verified_at, results_verified_by, closed_at, closed_by,
  cancelled_at, cancelled_by, cancellation_reason_code, cancellation_reason,
  archived_at, archived_by, archive_reason
) ON public.canonical_sessions TO authenticated;

DROP POLICY IF EXISTS canonical_sessions_staff_update ON public.canonical_sessions;
CREATE POLICY canonical_sessions_staff_update ON public.canonical_sessions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = canonical_sessions.team_id AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  )
  AND (
    archived_at IS NULL
    OR current_setting('app.evolution_session_lifecycle_action', true) = 'reopen'
  )
)
WITH CHECK (
  (archived_by IS NULL OR archived_by = (SELECT auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = canonical_sessions.team_id AND tm.user_id = (SELECT auth.uid())
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  )
);

CREATE SCHEMA IF NOT EXISTS evolution_private;
REVOKE ALL ON SCHEMA evolution_private FROM PUBLIC, anon, authenticated;

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
      OR (OLD.lifecycle_status = 'archived' AND NEW.lifecycle_status = 'closed')
      OR (OLD.lifecycle_status = 'cancelled' AND NEW.lifecycle_status = 'scheduled')
    ) THEN
      RAISE EXCEPTION 'invalid_canonical_session_reopen' USING ERRCODE = '22023';
    END IF;
    IF OLD.lifecycle_status = 'closed' THEN
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

REVOKE ALL ON FUNCTION evolution_private.guard_canonical_session_lifecycle()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.audit_canonical_session_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
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

REVOKE ALL ON FUNCTION evolution_private.audit_canonical_session_lifecycle()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS canonical_session_lifecycle_guard ON public.canonical_sessions;
CREATE TRIGGER canonical_session_lifecycle_guard
BEFORE UPDATE ON public.canonical_sessions
FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_canonical_session_lifecycle();

DROP TRIGGER IF EXISTS canonical_session_lifecycle_audit ON public.canonical_sessions;
CREATE TRIGGER canonical_session_lifecycle_audit
AFTER UPDATE OF lifecycle_status ON public.canonical_sessions
FOR EACH ROW WHEN (OLD.lifecycle_status IS DISTINCT FROM NEW.lifecycle_status)
EXECUTE FUNCTION evolution_private.audit_canonical_session_lifecycle();

CREATE OR REPLACE FUNCTION public.transition_canonical_session(
  p_session_id uuid,
  p_expected_version integer,
  p_target_status text,
  p_reason text,
  p_idempotency_key uuid,
  p_cancellation_reason_code text DEFAULT NULL
)
RETURNS public.canonical_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_session public.canonical_sessions;
  v_event public.canonical_session_lifecycle_events;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF p_idempotency_key IS NULL OR p_expected_version IS NULL
    OR p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500
  THEN
    RAISE EXCEPTION 'lifecycle_transition_arguments_invalid' USING ERRCODE = '22023';
  END IF;

  -- Read first so an ordinary team member receives an authorization denial
  -- rather than an RLS-filtered row-lock miss.
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_session.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;
  IF v_session.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived_session_requires_audited_reopen' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_session.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_event FROM public.canonical_session_lifecycle_events
  WHERE canonical_session_id = p_session_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_event.event_kind <> 'transition' OR v_event.new_status <> p_target_status
      OR v_event.reason <> pg_catalog.btrim(p_reason)
      OR v_event.cancellation_reason_code IS DISTINCT FROM p_cancellation_reason_code
    THEN RAISE EXCEPTION 'lifecycle_idempotency_key_reused_with_different_payload' USING ERRCODE = '22023'; END IF;
    RETURN v_session;
  END IF;
  IF v_session.lifecycle_version <> p_expected_version THEN
    RAISE EXCEPTION 'canonical_session_lifecycle_version_conflict' USING ERRCODE = '40001';
  END IF;

  PERFORM pg_catalog.set_config('app.evolution_session_lifecycle_action','transition',true);
  PERFORM pg_catalog.set_config('app.evolution_session_lifecycle_reason',pg_catalog.btrim(p_reason),true);
  PERFORM pg_catalog.set_config('app.evolution_session_lifecycle_idempotency_key',p_idempotency_key::text,true);
  PERFORM pg_catalog.set_config('app.evolution_session_cancellation_code',coalesce(p_cancellation_reason_code,''),true);

  UPDATE public.canonical_sessions
  SET lifecycle_status = p_target_status, lifecycle_version = lifecycle_version + 1
  WHERE id = p_session_id
  RETURNING * INTO v_session;
  RETURN v_session;
END;
$function$;

REVOKE ALL ON FUNCTION public.transition_canonical_session(uuid,integer,text,text,uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_canonical_session(uuid,integer,text,text,uuid,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_canonical_session(
  p_session_id uuid,
  p_expected_version integer,
  p_target_status text,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS public.canonical_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_session public.canonical_sessions;
  v_event public.canonical_session_lifecycle_events;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_idempotency_key IS NULL OR p_expected_version IS NULL
    OR p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'lifecycle_reopen_arguments_invalid' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_session.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  -- The archived-row UPDATE policy permits the row lock only in the reopen RPC context.
  PERFORM pg_catalog.set_config('app.evolution_session_lifecycle_action','reopen',true);
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_session.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_event FROM public.canonical_session_lifecycle_events
  WHERE canonical_session_id = p_session_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_event.event_kind <> 'reopen' OR v_event.new_status <> p_target_status
      OR v_event.reason <> pg_catalog.btrim(p_reason)
    THEN RAISE EXCEPTION 'lifecycle_idempotency_key_reused_with_different_payload' USING ERRCODE = '22023'; END IF;
    RETURN v_session;
  END IF;
  IF v_session.lifecycle_version <> p_expected_version THEN
    RAISE EXCEPTION 'canonical_session_lifecycle_version_conflict' USING ERRCODE = '40001';
  END IF;

  PERFORM pg_catalog.set_config('app.evolution_session_lifecycle_action','reopen',true);
  PERFORM pg_catalog.set_config('app.evolution_session_lifecycle_reason',pg_catalog.btrim(p_reason),true);
  PERFORM pg_catalog.set_config('app.evolution_session_lifecycle_idempotency_key',p_idempotency_key::text,true);
  PERFORM pg_catalog.set_config('app.evolution_session_cancellation_code','',true);

  UPDATE public.canonical_sessions
  SET lifecycle_status = p_target_status, lifecycle_version = lifecycle_version + 1
  WHERE id = p_session_id
  RETURNING * INTO v_session;
  RETURN v_session;
END;
$function$;

REVOKE ALL ON FUNCTION public.reopen_canonical_session(uuid,integer,text,text,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_canonical_session(uuid,integer,text,text,uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_canonical_session_results(
  p_session_id uuid,
  p_idempotency_key uuid
)
RETURNS public.canonical_session_result_submissions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_session public.canonical_sessions;
  v_submission public.canonical_session_result_submissions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'result_submission_idempotency_key_required' USING ERRCODE = '22023'; END IF;

  -- Authorize from the member-readable row before requesting an UPDATE row lock.
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_session.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  -- An already-recorded receipt remains idempotent after the session advances or archives.
  SELECT * INTO v_submission FROM public.canonical_session_result_submissions
  WHERE canonical_session_id = p_session_id;
  IF FOUND THEN
    IF v_submission.idempotency_key <> p_idempotency_key THEN
      RAISE EXCEPTION 'session_results_already_submitted_with_different_key' USING ERRCODE = '23505';
    END IF;
    RETURN v_submission;
  END IF;

  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_session.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;
  -- Recheck after the lock to serialize competing submissions.
  SELECT * INTO v_submission FROM public.canonical_session_result_submissions
  WHERE canonical_session_id = p_session_id;
  IF FOUND THEN
    IF v_submission.idempotency_key <> p_idempotency_key THEN
      RAISE EXCEPTION 'session_results_already_submitted_with_different_key' USING ERRCODE = '23505';
    END IF;
    RETURN v_submission;
  END IF;
  IF v_session.lifecycle_status <> 'awaiting_results' THEN
    RAISE EXCEPTION 'session_must_await_results_before_submission' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.canonical_session_result_submissions (
    team_id, canonical_session_id, idempotency_key, submitted_by
  ) VALUES (v_session.team_id, v_session.id, p_idempotency_key, auth.uid())
  ON CONFLICT (canonical_session_id) DO NOTHING
  RETURNING * INTO v_submission;

  IF NOT FOUND THEN
    SELECT * INTO v_submission FROM public.canonical_session_result_submissions
    WHERE canonical_session_id = p_session_id;
    IF v_submission.idempotency_key <> p_idempotency_key THEN
      RAISE EXCEPTION 'session_results_already_submitted_with_different_key' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN v_submission;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_canonical_session_results(uuid,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_canonical_session_results(uuid,uuid)
  TO authenticated;

GRANT SELECT ON public.canonical_session_lifecycle_events TO authenticated;
GRANT SELECT ON public.canonical_session_result_submissions TO authenticated;
REVOKE INSERT ON public.canonical_session_result_submissions FROM PUBLIC, anon, authenticated;
GRANT INSERT (team_id, canonical_session_id, idempotency_key, submitted_by)
  ON public.canonical_session_result_submissions TO authenticated;
REVOKE UPDATE, DELETE ON public.canonical_session_lifecycle_events FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.canonical_session_lifecycle_events FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.canonical_session_result_submissions FROM anon, authenticated;
REVOKE DELETE ON public.canonical_session_lifecycle_events, public.canonical_session_result_submissions FROM anon, authenticated;

COMMENT ON COLUMN public.canonical_sessions.lifecycle_status IS
  'Evolution Phase Two.4 lifecycle state. Existing canonical sessions are conservatively initialized to draft.';
COMMENT ON TABLE public.canonical_session_lifecycle_events IS
  'Append-only, team-scoped audit of canonical session lifecycle transitions and audited reopen corrections.';
COMMENT ON TABLE public.canonical_session_result_submissions IS
  'Immutable receipt that session results were submitted before lifecycle verification; detailed result correction belongs to Point 2.8.';
