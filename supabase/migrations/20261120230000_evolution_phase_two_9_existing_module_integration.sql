-- Evolution Version 2 · Phase 2.9
-- Connect legacy Scrims, Tournament and Training records to the canonical identity chain.
-- This migration is additive. It does not rewrite or delete source-module records.

CREATE OR REPLACE FUNCTION public.integrate_canonical_source(
  p_team_id uuid,
  p_source_system text,
  p_source_record_id uuid
)
RETURNS TABLE (
  canonical_session_id uuid,
  synced_match_count integer,
  source_system text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_title text;
  v_session_date date;
  v_scheduled_at timestamptz;
  v_existing_session_id uuid;
  v_session public.canonical_sessions;
  v_match_count integer := 0;
  v_idempotency_key uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF p_team_id IS NULL OR p_source_record_id IS NULL OR p_source_system IS NULL
    OR p_source_system NOT IN ('scrim','tournament','training')
  THEN
    RAISE EXCEPTION 'canonical_source_arguments_invalid' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN
    RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;

  -- A source-scoped transaction advisory lock serializes retries without
  -- requiring UPDATE privileges on legacy source tables.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_team_id::text || ':' || p_source_system || ':' || p_source_record_id::text, 0
  ));
  IF p_source_system = 'scrim' THEN
    SELECT 'Scrim · ' || sr.scrim_date::text, sr.scrim_date, NULL::timestamptz
      INTO v_title, v_session_date, v_scheduled_at
    FROM public.scrim_records sr
    WHERE sr.id = p_source_record_id AND sr.team_id = p_team_id
    ;
  ELSIF p_source_system = 'tournament' THEN
    SELECT COALESCE(NULLIF(pg_catalog.btrim(tc.title),''),'Tournament cycle'),
      tc.cycle_start, NULL::timestamptz
      INTO v_title, v_session_date, v_scheduled_at
    FROM public.tournament_cycles tc
    WHERE tc.id = p_source_record_id AND tc.team_id = p_team_id
    ;
  ELSE
    SELECT ts.title,
      CASE WHEN ts.scheduled_at IS NULL THEN NULL
        ELSE (ts.scheduled_at AT TIME ZONE 'Asia/Kolkata')::date END,
      ts.scheduled_at
      INTO v_title, v_session_date, v_scheduled_at
    FROM public.training_sessions ts
    WHERE ts.id = p_source_record_id AND ts.team_id = p_team_id
    ;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'canonical_source_record_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT css.canonical_session_id INTO v_existing_session_id
  FROM public.canonical_session_sources css
  WHERE css.team_id = p_team_id
    AND css.source_system = p_source_system
    AND css.source_record_id = p_source_record_id;
  IF FOUND THEN
    SELECT * INTO v_session
    FROM public.canonical_sessions cs
    WHERE cs.id = v_existing_session_id AND cs.team_id = p_team_id;
    IF NOT FOUND OR v_session.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'canonical_source_already_archived' USING ERRCODE = '23514';
    END IF;
  ELSE
    v_idempotency_key := pg_catalog.md5(
      p_team_id::text || ':' || p_source_system || ':' || p_source_record_id::text
    )::uuid;
    v_session := public.create_canonical_session(
      p_team_id,
      p_source_system,
      pg_catalog.left(COALESCE(NULLIF(pg_catalog.btrim(v_title),''),p_source_system),120),
      v_idempotency_key,
      v_session_date,
      v_scheduled_at,
      NULL
    );

    IF p_source_system = 'scrim' THEN
      INSERT INTO public.canonical_session_sources(
        team_id,canonical_session_id,source_system,scrim_record_id,created_by
      ) VALUES (p_team_id,v_session.id,'scrim',p_source_record_id,auth.uid());
    ELSIF p_source_system = 'tournament' THEN
      INSERT INTO public.canonical_session_sources(
        team_id,canonical_session_id,source_system,tournament_cycle_id,created_by
      ) VALUES (p_team_id,v_session.id,'tournament',p_source_record_id,auth.uid());
    ELSE
      INSERT INTO public.canonical_session_sources(
        team_id,canonical_session_id,source_system,training_session_id,created_by
      ) VALUES (p_team_id,v_session.id,'training',p_source_record_id,auth.uid());
    END IF;
  END IF;

  -- Scrim JSONB entries and Tournament match rows receive stable canonical
  -- match IDs through the existing idempotent match adapter. Training has no
  -- competitive match children and intentionally receives no phantom match.
  IF p_source_system IN ('scrim','tournament') THEN
    v_match_count := public.sync_canonical_session_matches(v_session.id);
  END IF;

  RETURN QUERY SELECT v_session.id, v_match_count, p_source_system;
END;
$function$;

REVOKE ALL ON FUNCTION public.integrate_canonical_source(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.integrate_canonical_source(uuid,text,uuid) TO authenticated;

COMMENT ON FUNCTION public.integrate_canonical_source(uuid,text,uuid) IS
  'Idempotently attaches one existing Scrim, Tournament cycle, or Training session to exactly one canonical session and synchronizes competitive match IDs. Planning remains a plan until an explicit Training session is created.';
