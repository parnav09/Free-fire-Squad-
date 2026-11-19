-- Evolution Phase Two.8 — Result Verification and Correction Audit
-- Additive result model. Raw submissions, verified values and decisions are distinct.
-- No legacy results are inferred or backfilled; no production data is touched.

CREATE TABLE IF NOT EXISTS public.canonical_session_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  canonical_session_match_id uuid,
  current_version_no integer NOT NULL DEFAULT 0 CHECK (current_version_no >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','verified','amended','rejected')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_results_session_team_fk
    FOREIGN KEY (canonical_session_id,team_id)
    REFERENCES public.canonical_sessions(id,team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_results_match_team_session_fk
    FOREIGN KEY (canonical_session_match_id,team_id,canonical_session_id)
    REFERENCES public.canonical_session_matches(id,team_id,canonical_session_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_results_id_team_unique UNIQUE(id,team_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS canonical_session_results_match_target_uidx
  ON public.canonical_session_results(canonical_session_match_id) WHERE canonical_session_match_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS canonical_session_results_training_target_uidx
  ON public.canonical_session_results(canonical_session_id) WHERE canonical_session_match_id IS NULL;
CREATE INDEX IF NOT EXISTS canonical_session_results_team_status_idx
  ON public.canonical_session_results(team_id,status,canonical_session_id);

CREATE TABLE IF NOT EXISTS public.canonical_session_result_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL,
  team_id uuid NOT NULL,
  version_no integer NOT NULL CHECK (version_no > 0),
  version_kind text NOT NULL CHECK (version_kind IN ('draft','submission','amendment')),
  result_source text NOT NULL CHECK (result_source IN ('official_scorecard','coach_report','team_record','training_log','other')),
  source_reference text CHECK (source_reference IS NULL OR char_length(source_reference) <= 500),
  raw_submitted_values jsonb NOT NULL CHECK (jsonb_typeof(raw_submitted_values)='object' AND raw_submitted_values <> '{}'::jsonb),
  correction_reason text CHECK (correction_reason IS NULL OR char_length(btrim(correction_reason)) BETWEEN 1 AND 500),
  idempotency_key uuid NOT NULL,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_result_versions_result_team_fk
    FOREIGN KEY (result_id,team_id) REFERENCES public.canonical_session_results(id,team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_result_versions_version_unique UNIQUE(result_id,team_id,version_no),
  CONSTRAINT canonical_session_result_versions_idempotency_unique UNIQUE(result_id,idempotency_key),
  CONSTRAINT canonical_session_result_versions_id_team_unique UNIQUE(id,result_id,team_id)
);

CREATE INDEX IF NOT EXISTS canonical_session_result_versions_result_idx
  ON public.canonical_session_result_versions(result_id,version_no DESC);

CREATE TABLE IF NOT EXISTS public.canonical_session_result_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL,
  team_id uuid NOT NULL,
  version_no integer NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('draft_saved','submitted','verified','rejected')),
  previous_status text NOT NULL CHECK (previous_status IN ('draft','submitted','verified','amended','rejected')),
  new_status text NOT NULL CHECK (new_status IN ('draft','submitted','verified','amended','rejected')),
  verified_values jsonb CHECK (verified_values IS NULL OR (jsonb_typeof(verified_values)='object' AND verified_values <> '{}'::jsonb)),
  verification_checklist jsonb CHECK (verification_checklist IS NULL OR jsonb_typeof(verification_checklist)='object'),
  reason text CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 500),
  idempotency_key uuid NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_result_events_result_team_fk
    FOREIGN KEY (result_id,team_id) REFERENCES public.canonical_session_results(id,team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_result_events_version_fk
    FOREIGN KEY (result_id,team_id,version_no)
    REFERENCES public.canonical_session_result_versions(result_id,team_id,version_no) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_result_events_idempotency_unique UNIQUE(result_id,idempotency_key),
  CONSTRAINT canonical_session_result_events_state_change CHECK (previous_status <> new_status OR event_kind='draft_saved'),
  CONSTRAINT canonical_session_result_events_decision_shape CHECK (
    (event_kind='verified' AND verified_values IS NOT NULL AND verification_checklist IS NOT NULL
      AND new_status IN ('verified','amended'))
    OR (event_kind<>'verified' AND verified_values IS NULL AND verification_checklist IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS canonical_session_result_events_timeline_idx
  ON public.canonical_session_result_events(team_id,result_id,changed_at,version_no);

ALTER TABLE public.canonical_session_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_result_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_result_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS canonical_session_results_staff_read ON public.canonical_session_results;
CREATE POLICY canonical_session_results_staff_read ON public.canonical_session_results
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.team_members tm WHERE tm.team_id=canonical_session_results.team_id
      AND tm.user_id=auth.uid() AND tm.status='active' AND tm.membership_role IN ('owner','coach')
  ));
DROP POLICY IF EXISTS canonical_session_result_versions_staff_read ON public.canonical_session_result_versions;
CREATE POLICY canonical_session_result_versions_staff_read ON public.canonical_session_result_versions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.team_members tm WHERE tm.team_id=canonical_session_result_versions.team_id
      AND tm.user_id=auth.uid() AND tm.status='active' AND tm.membership_role IN ('owner','coach')
  ));
DROP POLICY IF EXISTS canonical_session_result_events_staff_read ON public.canonical_session_result_events;
CREATE POLICY canonical_session_result_events_staff_read ON public.canonical_session_result_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.team_members tm WHERE tm.team_id=canonical_session_result_events.team_id
      AND tm.user_id=auth.uid() AND tm.status='active' AND tm.membership_role IN ('owner','coach')
  ));

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_result_root()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF TG_OP='INSERT' AND pg_catalog.current_setting('app.evolution_result_write',true)='root' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND pg_catalog.current_setting('app.evolution_result_write',true)='root' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'canonical_session_result_root_rpc_required' USING ERRCODE='42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_result_append()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF TG_OP='INSERT' AND pg_catalog.current_setting('app.evolution_result_write',true)='append' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'canonical_session_result_history_is_append_only' USING ERRCODE='42501';
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.guard_canonical_session_result_root() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION evolution_private.guard_canonical_session_result_append() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS canonical_session_result_root_guard ON public.canonical_session_results;
CREATE TRIGGER canonical_session_result_root_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.canonical_session_results FOR EACH ROW
  EXECUTE FUNCTION evolution_private.guard_canonical_session_result_root();
DROP TRIGGER IF EXISTS canonical_session_result_versions_guard ON public.canonical_session_result_versions;
CREATE TRIGGER canonical_session_result_versions_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.canonical_session_result_versions FOR EACH ROW
  EXECUTE FUNCTION evolution_private.guard_canonical_session_result_append();
DROP TRIGGER IF EXISTS canonical_session_result_events_guard ON public.canonical_session_result_events;
CREATE TRIGGER canonical_session_result_events_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.canonical_session_result_events FOR EACH ROW
  EXECUTE FUNCTION evolution_private.guard_canonical_session_result_append();

REVOKE INSERT,UPDATE,DELETE ON public.canonical_session_results,
  public.canonical_session_result_versions,public.canonical_session_result_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.canonical_session_results,public.canonical_session_result_versions,
  public.canonical_session_result_events TO authenticated;

CREATE OR REPLACE FUNCTION public.save_canonical_session_result_draft(
  p_session_id uuid,p_match_id uuid,p_result_source text,p_source_reference text,
  p_raw_values jsonb,p_idempotency_key uuid
)
RETURNS public.canonical_session_results
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_session public.canonical_sessions;
  v_result public.canonical_session_results;
  v_version public.canonical_session_result_versions;
  v_existing public.canonical_session_result_events;
  v_version_no integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
  IF p_idempotency_key IS NULL OR p_raw_values IS NULL OR jsonb_typeof(p_raw_values)<>'object'
    OR p_raw_values='{}'::jsonb OR p_result_source IS NULL OR p_result_source NOT IN ('official_scorecard','coach_report','team_record','training_log','other')
    OR (p_source_reference IS NOT NULL AND char_length(p_source_reference)>500)
  THEN RAISE EXCEPTION 'canonical_result_draft_arguments_invalid' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.team_members tm WHERE tm.team_id=v_session.team_id
    AND tm.user_id=auth.uid() AND tm.status='active' AND tm.membership_role IN ('owner','coach'))
  THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE='42501'; END IF;
  IF v_session.archived_at IS NOT NULL OR v_session.lifecycle_status NOT IN ('in_progress','awaiting_results')
  THEN RAISE EXCEPTION 'canonical_result_draft_requires_active_session' USING ERRCODE='23514'; END IF;
  IF (v_session.session_type='training' AND p_match_id IS NOT NULL)
    OR (v_session.session_type IN ('scrim','tournament') AND p_match_id IS NULL)
  THEN RAISE EXCEPTION 'canonical_result_target_scope_invalid' USING ERRCODE='22023'; END IF;
  IF v_session.session_type='training' AND p_result_source='official_scorecard'
  THEN RAISE EXCEPTION 'training_result_source_invalid' USING ERRCODE='22023'; END IF;
  IF v_session.session_type IN ('scrim','tournament') AND p_result_source='training_log'
  THEN RAISE EXCEPTION 'competitive_result_source_invalid' USING ERRCODE='22023'; END IF;
  IF p_match_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.canonical_session_matches cm
    WHERE cm.id=p_match_id AND cm.canonical_session_id=v_session.id AND cm.team_id=v_session.team_id)
  THEN RAISE EXCEPTION 'canonical_result_match_session_mismatch' USING ERRCODE='23503'; END IF;

  PERFORM pg_catalog.set_config('app.evolution_result_write','root',true);
  IF p_match_id IS NULL THEN
    INSERT INTO public.canonical_session_results(team_id,canonical_session_id,canonical_session_match_id,created_by)
    VALUES(v_session.team_id,v_session.id,NULL,auth.uid())
    ON CONFLICT(canonical_session_id) WHERE canonical_session_match_id IS NULL DO NOTHING;
    SELECT * INTO v_result FROM public.canonical_session_results
      WHERE canonical_session_id=v_session.id AND canonical_session_match_id IS NULL FOR UPDATE;
  ELSE
    INSERT INTO public.canonical_session_results(team_id,canonical_session_id,canonical_session_match_id,created_by)
    VALUES(v_session.team_id,v_session.id,p_match_id,auth.uid())
    ON CONFLICT(canonical_session_match_id) WHERE canonical_session_match_id IS NOT NULL DO NOTHING;
    SELECT * INTO v_result FROM public.canonical_session_results
      WHERE canonical_session_match_id=p_match_id FOR UPDATE;
  END IF;
  SELECT * INTO v_existing FROM public.canonical_session_result_events
    WHERE result_id=v_result.id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    SELECT * INTO v_version FROM public.canonical_session_result_versions
      WHERE result_id=v_result.id AND version_no=v_existing.version_no;
    IF v_existing.event_kind<>'draft_saved' OR v_version.raw_submitted_values IS DISTINCT FROM p_raw_values
      OR v_version.result_source<>p_result_source OR v_version.source_reference IS DISTINCT FROM p_source_reference
    THEN RAISE EXCEPTION 'canonical_result_idempotency_conflict' USING ERRCODE='22023'; END IF;
    RETURN v_result;
  END IF;
  IF v_result.status<>'draft' THEN RAISE EXCEPTION 'canonical_result_draft_not_editable' USING ERRCODE='23514'; END IF;
  v_version_no:=v_result.current_version_no+1;
  PERFORM pg_catalog.set_config('app.evolution_result_write','append',true);
  INSERT INTO public.canonical_session_result_versions(result_id,team_id,version_no,version_kind,
    result_source,source_reference,raw_submitted_values,idempotency_key,submitted_by)
  VALUES(v_result.id,v_result.team_id,v_version_no,'draft',p_result_source,p_source_reference,
    p_raw_values,p_idempotency_key,auth.uid()) RETURNING * INTO v_version;
  INSERT INTO public.canonical_session_result_events(result_id,team_id,version_no,event_kind,
    previous_status,new_status,idempotency_key,changed_by)
  VALUES(v_result.id,v_result.team_id,v_version_no,'draft_saved','draft','draft',p_idempotency_key,auth.uid());
  PERFORM pg_catalog.set_config('app.evolution_result_write','root',true);
  UPDATE public.canonical_session_results SET current_version_no=v_version_no,updated_at=clock_timestamp()
    WHERE id=v_result.id RETURNING * INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_canonical_session_result(
  p_session_id uuid,p_match_id uuid,p_result_source text,p_source_reference text,
  p_raw_values jsonb,p_idempotency_key uuid,p_correction_reason text DEFAULT NULL
)
RETURNS public.canonical_session_results
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_session public.canonical_sessions;
  v_result public.canonical_session_results;
  v_version public.canonical_session_result_versions;
  v_existing public.canonical_session_result_events;
  v_version_no integer;
  v_kind text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
  IF p_idempotency_key IS NULL OR p_raw_values IS NULL OR jsonb_typeof(p_raw_values)<>'object'
    OR p_raw_values='{}'::jsonb OR p_result_source IS NULL OR p_result_source NOT IN ('official_scorecard','coach_report','team_record','training_log','other')
    OR (p_source_reference IS NOT NULL AND char_length(p_source_reference)>500)
    OR (p_correction_reason IS NOT NULL AND char_length(btrim(p_correction_reason)) NOT BETWEEN 1 AND 500)
  THEN RAISE EXCEPTION 'canonical_result_submission_arguments_invalid' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.team_members tm WHERE tm.team_id=v_session.team_id
    AND tm.user_id=auth.uid() AND tm.status='active' AND tm.membership_role IN ('owner','coach'))
  THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE='42501'; END IF;
  IF v_session.archived_at IS NOT NULL OR v_session.lifecycle_status<>'awaiting_results'
  THEN RAISE EXCEPTION 'canonical_result_submission_requires_awaiting_results' USING ERRCODE='23514'; END IF;
  IF (v_session.session_type='training' AND p_match_id IS NOT NULL)
    OR (v_session.session_type IN ('scrim','tournament') AND p_match_id IS NULL)
  THEN RAISE EXCEPTION 'canonical_result_target_scope_invalid' USING ERRCODE='22023'; END IF;
  IF v_session.session_type='training' AND p_result_source='official_scorecard'
  THEN RAISE EXCEPTION 'training_result_source_invalid' USING ERRCODE='22023'; END IF;
  IF v_session.session_type IN ('scrim','tournament') AND p_result_source='training_log'
  THEN RAISE EXCEPTION 'competitive_result_source_invalid' USING ERRCODE='22023'; END IF;
  IF p_match_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.canonical_session_matches cm
    WHERE cm.id=p_match_id AND cm.canonical_session_id=v_session.id AND cm.team_id=v_session.team_id)
  THEN RAISE EXCEPTION 'canonical_result_match_session_mismatch' USING ERRCODE='23503'; END IF;

  IF p_match_id IS NULL THEN
    INSERT INTO public.canonical_session_results(team_id,canonical_session_id,canonical_session_match_id,created_by)
    VALUES(v_session.team_id,v_session.id,NULL,auth.uid())
    ON CONFLICT(canonical_session_id) WHERE canonical_session_match_id IS NULL DO NOTHING;
    SELECT * INTO v_result FROM public.canonical_session_results
      WHERE canonical_session_id=v_session.id AND canonical_session_match_id IS NULL FOR UPDATE;
  ELSE
    INSERT INTO public.canonical_session_results(team_id,canonical_session_id,canonical_session_match_id,created_by)
    VALUES(v_session.team_id,v_session.id,p_match_id,auth.uid())
    ON CONFLICT(canonical_session_match_id) WHERE canonical_session_match_id IS NOT NULL DO NOTHING;
    SELECT * INTO v_result FROM public.canonical_session_results
      WHERE canonical_session_match_id=p_match_id FOR UPDATE;
  END IF;
  SELECT * INTO v_existing FROM public.canonical_session_result_events
    WHERE result_id=v_result.id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    SELECT * INTO v_version FROM public.canonical_session_result_versions
      WHERE result_id=v_result.id AND version_no=v_existing.version_no;
    IF v_existing.event_kind<>'submitted' OR v_version.raw_submitted_values IS DISTINCT FROM p_raw_values
      OR v_version.result_source<>p_result_source OR v_version.source_reference IS DISTINCT FROM p_source_reference
      OR v_version.correction_reason IS DISTINCT FROM nullif(pg_catalog.btrim(coalesce(p_correction_reason,'')),'')
    THEN RAISE EXCEPTION 'canonical_result_idempotency_conflict' USING ERRCODE='22023'; END IF;
    RETURN v_result;
  END IF;
  IF v_result.status='submitted' THEN RAISE EXCEPTION 'canonical_result_already_pending_verification' USING ERRCODE='23514'; END IF;
  IF v_result.current_version_no>0 AND (p_correction_reason IS NULL OR char_length(btrim(p_correction_reason)) NOT BETWEEN 1 AND 500)
  THEN RAISE EXCEPTION 'canonical_result_correction_reason_required' USING ERRCODE='22023'; END IF;
  v_version_no:=v_result.current_version_no+1;
  v_kind:=CASE WHEN v_version_no=1 THEN 'submission' ELSE 'amendment' END;

  PERFORM pg_catalog.set_config('app.evolution_result_write','append',true);
  INSERT INTO public.canonical_session_result_versions(result_id,team_id,version_no,version_kind,
    result_source,source_reference,raw_submitted_values,correction_reason,idempotency_key,submitted_by)
  VALUES(v_result.id,v_result.team_id,v_version_no,v_kind,p_result_source,p_source_reference,
    p_raw_values,nullif(pg_catalog.btrim(coalesce(p_correction_reason,'')),''),p_idempotency_key,auth.uid())
  RETURNING * INTO v_version;
  INSERT INTO public.canonical_session_result_events(result_id,team_id,version_no,event_kind,
    previous_status,new_status,reason,idempotency_key,changed_by)
  VALUES(v_result.id,v_result.team_id,v_version_no,'submitted',v_result.status,'submitted',
    nullif(pg_catalog.btrim(coalesce(p_correction_reason,'')),''),p_idempotency_key,auth.uid());
  PERFORM pg_catalog.set_config('app.evolution_result_write','root',true);
  UPDATE public.canonical_session_results SET current_version_no=v_version_no,status='submitted',
    updated_at=clock_timestamp() WHERE id=v_result.id RETURNING * INTO v_result;

  IF NOT EXISTS(SELECT 1 FROM public.canonical_session_result_submissions
    WHERE canonical_session_id=p_session_id)
  THEN
    PERFORM public.submit_canonical_session_results(p_session_id,p_idempotency_key);
  END IF;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_canonical_session_result(
  p_result_id uuid,p_verified_values jsonb,p_checklist jsonb,p_reason text,p_idempotency_key uuid
)
RETURNS public.canonical_session_results
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_result public.canonical_session_results;
  v_session public.canonical_sessions;
  v_event public.canonical_session_result_events;
  v_version public.canonical_session_result_versions;
  v_required_keys text[];
  v_next_status text;
  v_event_reason text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
  IF p_idempotency_key IS NULL OR p_verified_values IS NULL OR jsonb_typeof(p_verified_values)<>'object'
    OR p_verified_values='{}'::jsonb OR p_checklist IS NULL OR jsonb_typeof(p_checklist)<>'object'
    OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'canonical_result_verification_arguments_invalid' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_result FROM public.canonical_session_results WHERE id=p_result_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_result_not_found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id=v_result.canonical_session_id;
  IF NOT EXISTS(SELECT 1 FROM public.team_members tm WHERE tm.team_id=v_result.team_id
    AND tm.user_id=auth.uid() AND tm.status='active' AND tm.membership_role IN ('owner','coach'))
  THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_event FROM public.canonical_session_result_events
    WHERE result_id=v_result.id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_event.event_kind<>'verified' OR v_event.verified_values IS DISTINCT FROM p_verified_values
      OR v_event.verification_checklist IS DISTINCT FROM p_checklist
      OR v_event.reason IS DISTINCT FROM pg_catalog.btrim(p_reason)
    THEN RAISE EXCEPTION 'canonical_result_verification_idempotency_conflict' USING ERRCODE='22023'; END IF;
    RETURN v_result;
  END IF;
  IF v_result.status<>'submitted' THEN RAISE EXCEPTION 'canonical_result_requires_submitted_state' USING ERRCODE='23514'; END IF;
  IF v_session.archived_at IS NOT NULL OR v_session.lifecycle_status NOT IN ('awaiting_results','verified')
  THEN RAISE EXCEPTION 'canonical_result_verification_session_state_invalid' USING ERRCODE='23514'; END IF;

  IF v_session.session_type='training' THEN
    v_required_keys:=ARRAY['source_identity_confirmed','activity_confirmed','participants_confirmed','no_inferred_values'];
  ELSE
    v_required_keys:=ARRAY['source_identity_confirmed','match_identity_confirmed','values_reviewed','no_inferred_values'];
  END IF;
  IF jsonb_object_length(p_checklist)<>4 OR EXISTS(
    SELECT 1 FROM unnest(v_required_keys) k WHERE p_checklist->k IS DISTINCT FROM 'true'::jsonb
  ) THEN RAISE EXCEPTION 'canonical_result_verification_checklist_incomplete' USING ERRCODE='23514'; END IF;

  SELECT * INTO v_version FROM public.canonical_session_result_versions
    WHERE result_id=v_result.id AND version_no=v_result.current_version_no;
  v_next_status:=CASE WHEN v_version.version_no=1 THEN 'verified' ELSE 'amended' END;
  PERFORM pg_catalog.set_config('app.evolution_result_write','append',true);
  INSERT INTO public.canonical_session_result_events(result_id,team_id,version_no,event_kind,
    previous_status,new_status,verified_values,verification_checklist,reason,idempotency_key,changed_by)
  VALUES(v_result.id,v_result.team_id,v_version.version_no,'verified',v_result.status,v_next_status,
    p_verified_values,p_checklist,pg_catalog.btrim(p_reason),p_idempotency_key,auth.uid());
  PERFORM pg_catalog.set_config('app.evolution_result_write','root',true);
  UPDATE public.canonical_session_results SET status=v_next_status,updated_at=clock_timestamp()
    WHERE id=v_result.id RETURNING * INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_canonical_session_result(
  p_result_id uuid,p_reason text,p_idempotency_key uuid
)
RETURNS public.canonical_session_results
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_result public.canonical_session_results;
  v_event public.canonical_session_result_events;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
  IF p_idempotency_key IS NULL OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'canonical_result_rejection_arguments_invalid' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_result FROM public.canonical_session_results WHERE id=p_result_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_result_not_found' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.team_members tm WHERE tm.team_id=v_result.team_id
    AND tm.user_id=auth.uid() AND tm.status='active' AND tm.membership_role IN ('owner','coach'))
  THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_event FROM public.canonical_session_result_events
    WHERE result_id=v_result.id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_event.event_kind<>'rejected' OR v_event.reason<>pg_catalog.btrim(p_reason)
    THEN RAISE EXCEPTION 'canonical_result_rejection_idempotency_conflict' USING ERRCODE='22023'; END IF;
    RETURN v_result;
  END IF;
  IF v_result.status<>'submitted' THEN RAISE EXCEPTION 'canonical_result_requires_submitted_state' USING ERRCODE='23514'; END IF;
  PERFORM pg_catalog.set_config('app.evolution_result_write','append',true);
  INSERT INTO public.canonical_session_result_events(result_id,team_id,version_no,event_kind,
    previous_status,new_status,reason,idempotency_key,changed_by)
  VALUES(v_result.id,v_result.team_id,v_result.current_version_no,'rejected','submitted','rejected',
    pg_catalog.btrim(p_reason),p_idempotency_key,auth.uid());
  PERFORM pg_catalog.set_config('app.evolution_result_write','root',true);
  UPDATE public.canonical_session_results SET status='rejected',updated_at=clock_timestamp()
    WHERE id=v_result.id RETURNING * INTO v_result;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_canonical_session_result_draft(uuid,uuid,text,text,jsonb,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.submit_canonical_session_result(uuid,uuid,text,text,jsonb,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.verify_canonical_session_result(uuid,jsonb,jsonb,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.reject_canonical_session_result(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_canonical_session_result_draft(uuid,uuid,text,text,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_canonical_session_result(uuid,uuid,text,text,jsonb,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_canonical_session_result(uuid,jsonb,jsonb,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_canonical_session_result(uuid,text,uuid) TO authenticated;

CREATE OR REPLACE VIEW public.canonical_verified_competitive_match_results
WITH (security_invoker=true) AS
SELECT r.id AS result_id,r.team_id,r.canonical_session_id,r.canonical_session_match_id,
  v.version_no,v.result_source,v.source_reference,v.raw_submitted_values,
  e.verified_values,e.verification_checklist,v.submitted_by,v.submitted_at,
  e.changed_by AS verified_by,e.changed_at AS verified_at,e.reason AS verification_reason
FROM public.canonical_session_results r
JOIN public.canonical_sessions s ON s.id=r.canonical_session_id
JOIN public.canonical_session_result_versions v
  ON v.result_id=r.id AND v.version_no=r.current_version_no
JOIN public.canonical_session_result_events e
  ON e.result_id=r.id AND e.version_no=v.version_no AND e.event_kind='verified'
WHERE s.session_type IN ('scrim','tournament') AND r.canonical_session_match_id IS NOT NULL
  AND r.status IN ('verified','amended');

CREATE OR REPLACE VIEW public.canonical_verified_training_results
WITH (security_invoker=true) AS
SELECT r.id AS result_id,r.team_id,r.canonical_session_id,
  v.version_no,v.result_source,v.source_reference,v.raw_submitted_values,
  e.verified_values,e.verification_checklist,v.submitted_by,v.submitted_at,
  e.changed_by AS verified_by,e.changed_at AS verified_at,e.reason AS verification_reason
FROM public.canonical_session_results r
JOIN public.canonical_sessions s ON s.id=r.canonical_session_id
JOIN public.canonical_session_result_versions v
  ON v.result_id=r.id AND v.version_no=r.current_version_no
JOIN public.canonical_session_result_events e
  ON e.result_id=r.id AND e.version_no=v.version_no AND e.event_kind='verified'
WHERE s.session_type='training' AND r.canonical_session_match_id IS NULL
  AND r.status IN ('verified','amended');

GRANT SELECT ON public.canonical_verified_competitive_match_results,
  public.canonical_verified_training_results TO authenticated;

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
  -- A committed retry must remain idempotent even if the original transition archived the row.
  SELECT * INTO v_event FROM public.canonical_session_lifecycle_events
  WHERE canonical_session_id = p_session_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_event.event_kind <> 'transition' OR v_event.new_status <> p_target_status
      OR v_event.reason <> pg_catalog.btrim(p_reason)
      OR v_event.cancellation_reason_code IS DISTINCT FROM p_cancellation_reason_code
    THEN RAISE EXCEPTION 'lifecycle_idempotency_key_reused_with_different_payload' USING ERRCODE = '22023'; END IF;
    RETURN v_session;
  END IF;
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

  -- Recheck after locking to serialize competing requests with the same key.
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
  IF p_target_status = 'verified' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.canonical_session_results r
      WHERE r.canonical_session_id = v_session.id
        AND r.status IN ('verified','amended')
    ) THEN
      RAISE EXCEPTION 'canonical_session_requires_verified_result_records' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.canonical_session_results r
      WHERE r.canonical_session_id = v_session.id
        AND r.status NOT IN ('verified','amended')
    ) THEN
      RAISE EXCEPTION 'canonical_session_has_unverified_result_records' USING ERRCODE = '23514';
    END IF;
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


REVOKE ALL ON FUNCTION public.transition_canonical_session(uuid,integer,text,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_canonical_session(uuid,integer,text,text,uuid,text) TO authenticated;

COMMENT ON TABLE public.canonical_session_results IS
  'Current result workflow state per canonical match (Scrim/Tournament) or canonical Training session. Raw and verified values are held in immutable versions and decision events.';
COMMENT ON TABLE public.canonical_session_result_versions IS
  'Append-only raw result submissions and amendments. Values are captured as explicitly supplied; no score metrics are inferred or defaulted.';
COMMENT ON TABLE public.canonical_session_result_events IS
  'Append-only draft, submission, verification and rejection decisions, including verified values, source checklist, actor and server timestamp.';
COMMENT ON VIEW public.canonical_verified_competitive_match_results IS
  'Only current verified/amended canonical Scrim/Tournament match results; safe eligibility input for official competitive aggregates.';
