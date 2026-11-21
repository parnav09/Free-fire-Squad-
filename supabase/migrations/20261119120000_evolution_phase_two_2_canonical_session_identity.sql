-- Evolution Phase Two.2 — Canonical Session Identity
-- Additive only: no legacy rows are rewritten and no source module is replaced.
-- Source references are relational and team-scoped; display labels remain mutable.

CREATE UNIQUE INDEX IF NOT EXISTS scrim_records_id_team_uidx ON public.scrim_records (id, team_id);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_cycles_id_team_uidx ON public.tournament_cycles (id, team_id);
CREATE UNIQUE INDEX IF NOT EXISTS training_sessions_id_team_uidx ON public.training_sessions (id, team_id);

CREATE TABLE IF NOT EXISTS public.canonical_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  session_type text NOT NULL CHECK (session_type IN ('scrim', 'tournament', 'training')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  session_date date,
  scheduled_at timestamptz,
  season_label text CHECK (season_label IS NULL OR char_length(btrim(season_label)) BETWEEN 1 AND 80),
  idempotency_key uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  archive_reason text,
  CONSTRAINT canonical_sessions_archive_actor_pair CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  CONSTRAINT canonical_sessions_archive_reason_length CHECK (archive_reason IS NULL OR char_length(archive_reason) <= 500),
  CONSTRAINT canonical_sessions_id_team_unique UNIQUE (id, team_id),
  CONSTRAINT canonical_sessions_team_idempotency_unique UNIQUE (team_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS canonical_sessions_team_date_idx ON public.canonical_sessions (team_id, session_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS canonical_sessions_team_type_idx ON public.canonical_sessions (team_id, session_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.canonical_session_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  source_system text NOT NULL CHECK (source_system IN ('scrim', 'tournament', 'training')),
  scrim_record_id uuid,
  tournament_cycle_id uuid,
  training_session_id uuid,
  source_record_id uuid GENERATED ALWAYS AS (COALESCE(scrim_record_id, tournament_cycle_id, training_session_id)) STORED,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_session_sources_exactly_one_source CHECK (
    (source_system = 'scrim' AND scrim_record_id IS NOT NULL AND tournament_cycle_id IS NULL AND training_session_id IS NULL)
    OR (source_system = 'tournament' AND scrim_record_id IS NULL AND tournament_cycle_id IS NOT NULL AND training_session_id IS NULL)
    OR (source_system = 'training' AND scrim_record_id IS NULL AND tournament_cycle_id IS NULL AND training_session_id IS NOT NULL)
  ),
  CONSTRAINT canonical_session_sources_session_team_fk FOREIGN KEY (canonical_session_id, team_id)
    REFERENCES public.canonical_sessions (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_sources_scrim_team_fk FOREIGN KEY (scrim_record_id, team_id)
    REFERENCES public.scrim_records (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_sources_tournament_team_fk FOREIGN KEY (tournament_cycle_id, team_id)
    REFERENCES public.tournament_cycles (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_sources_training_team_fk FOREIGN KEY (training_session_id, team_id)
    REFERENCES public.training_sessions (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_sources_one_source_per_type UNIQUE (canonical_session_id, source_system),
  CONSTRAINT canonical_session_sources_unique_source UNIQUE (source_system, source_record_id)
);

CREATE INDEX IF NOT EXISTS canonical_session_sources_team_idx ON public.canonical_session_sources (team_id, canonical_session_id);

ALTER TABLE public.canonical_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS canonical_sessions_team_read ON public.canonical_sessions;
CREATE POLICY canonical_sessions_team_read ON public.canonical_sessions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.team_id = canonical_sessions.team_id AND tm.user_id = (select auth.uid()) AND tm.status = 'active'
));

DROP POLICY IF EXISTS canonical_sessions_staff_insert ON public.canonical_sessions;
CREATE POLICY canonical_sessions_staff_insert ON public.canonical_sessions FOR INSERT TO authenticated
WITH CHECK (
  created_by = (select auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = canonical_sessions.team_id AND tm.user_id = (select auth.uid())
      AND tm.status = 'active' AND tm.membership_role IN ('owner', 'coach')
  )
);

DROP POLICY IF EXISTS canonical_sessions_staff_update ON public.canonical_sessions;
CREATE POLICY canonical_sessions_staff_update ON public.canonical_sessions FOR UPDATE TO authenticated
USING (
  archived_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = canonical_sessions.team_id AND tm.user_id = (select auth.uid())
      AND tm.status = 'active' AND tm.membership_role IN ('owner', 'coach')
  )
)
WITH CHECK (
  (archived_by IS NULL OR archived_by = (select auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = canonical_sessions.team_id AND tm.user_id = (select auth.uid())
      AND tm.status = 'active' AND tm.membership_role IN ('owner', 'coach')
  )
);

DROP POLICY IF EXISTS canonical_session_sources_team_read ON public.canonical_session_sources;
CREATE POLICY canonical_session_sources_team_read ON public.canonical_session_sources FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.team_id = canonical_session_sources.team_id AND tm.user_id = (select auth.uid()) AND tm.status = 'active'
));

DROP POLICY IF EXISTS canonical_session_sources_staff_insert ON public.canonical_session_sources;
CREATE POLICY canonical_session_sources_staff_insert ON public.canonical_session_sources FOR INSERT TO authenticated
WITH CHECK (
  created_by = (select auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.canonical_sessions cs
      ON cs.id = canonical_session_sources.canonical_session_id
     AND cs.team_id = canonical_session_sources.team_id
     AND cs.session_type = canonical_session_sources.source_system
     AND cs.archived_at IS NULL
    WHERE tm.team_id = canonical_session_sources.team_id
      AND tm.user_id = (select auth.uid()) AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
);

GRANT SELECT, INSERT, UPDATE ON public.canonical_sessions TO authenticated;
GRANT SELECT, INSERT ON public.canonical_session_sources TO authenticated;
REVOKE DELETE ON public.canonical_sessions, public.canonical_session_sources FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_canonical_session(
  p_team_id uuid, p_session_type text, p_title text, p_idempotency_key uuid,
  p_session_date date DEFAULT NULL, p_scheduled_at timestamptz DEFAULT NULL, p_season_label text DEFAULT NULL
)
RETURNS public.canonical_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.canonical_sessions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner', 'coach')
  ) THEN
    RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.canonical_sessions (
    team_id, session_type, title, session_date, scheduled_at, season_label, idempotency_key, created_by
  )
  VALUES (p_team_id, p_session_type, p_title, p_session_date, p_scheduled_at, p_season_label, p_idempotency_key, auth.uid())
  ON CONFLICT (team_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_session;

  IF NOT FOUND THEN
    SELECT * INTO v_session FROM public.canonical_sessions
    WHERE team_id = p_team_id AND idempotency_key = p_idempotency_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'idempotent_session_not_visible' USING ERRCODE = '42501';
    END IF;
    IF v_session.session_type IS DISTINCT FROM p_session_type
      OR v_session.title IS DISTINCT FROM p_title
      OR v_session.session_date IS DISTINCT FROM p_session_date
      OR v_session.scheduled_at IS DISTINCT FROM p_scheduled_at
      OR v_session.season_label IS DISTINCT FROM p_season_label THEN
      RAISE EXCEPTION 'idempotency_key_reused_with_different_payload' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.create_canonical_session(uuid, text, text, uuid, date, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_canonical_session(uuid, text, text, uuid, date, timestamptz, text) TO authenticated;

COMMENT ON TABLE public.canonical_sessions IS
  'Evolution Phase Two.2 canonical session identity. UUID is the stable key; titles, dates and season labels are descriptive attributes.';
COMMENT ON TABLE public.canonical_session_sources IS
  'Team-scoped immutable source mapping from legacy Scrim, Tournament cycle or Training session IDs to a canonical session UUID.';

-- Backfill eligible historical Training sessions without rewriting their legacy IDs.
-- No season/cycle is inferred: historical season_label remains NULL until an audited mapping exists.
INSERT INTO public.canonical_sessions (
  id, team_id, session_type, title, scheduled_at, season_label,
  idempotency_key, created_by, created_at
)
SELECT
  md5('squad-os:legacy-training-session:' || ts.id::text)::uuid,
  ts.team_id,
  'training',
  ts.title,
  ts.scheduled_at,
  NULL,
  md5('squad-os:legacy-training-idempotency:' || ts.id::text)::uuid,
  ts.created_by,
  ts.created_at
FROM public.training_sessions ts
WHERE ts.created_by IS NOT NULL
  AND char_length(btrim(ts.title)) BETWEEN 1 AND 120
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.training_sessions ts
    JOIN public.canonical_sessions cs
      ON cs.id = md5('squad-os:legacy-training-session:' || ts.id::text)::uuid
    WHERE ts.created_by IS NOT NULL
      AND char_length(btrim(ts.title)) BETWEEN 1 AND 120
      AND (
        cs.team_id IS DISTINCT FROM ts.team_id
        OR cs.session_type IS DISTINCT FROM 'training'
        OR cs.title IS DISTINCT FROM ts.title
        OR cs.created_by IS DISTINCT FROM ts.created_by
      )
  ) THEN
    RAISE EXCEPTION 'historical_training_canonical_identity_conflict';
  END IF;
END;
$$;

INSERT INTO public.canonical_session_sources (
  team_id, canonical_session_id, source_system, training_session_id, created_by
)
SELECT
  ts.team_id,
  md5('squad-os:legacy-training-session:' || ts.id::text)::uuid,
  'training',
  ts.id,
  ts.created_by
FROM public.training_sessions ts
JOIN public.canonical_sessions cs
  ON cs.id = md5('squad-os:legacy-training-session:' || ts.id::text)::uuid
 AND cs.team_id = ts.team_id
WHERE ts.created_by IS NOT NULL
  AND char_length(btrim(ts.title)) BETWEEN 1 AND 120
ON CONFLICT (source_system, source_record_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.training_sessions ts
    JOIN public.canonical_sessions cs
      ON cs.id = md5('squad-os:legacy-training-session:' || ts.id::text)::uuid
     AND cs.team_id = ts.team_id
    LEFT JOIN public.canonical_session_sources src
      ON src.source_system = 'training'
     AND src.source_record_id = ts.id
    WHERE ts.created_by IS NOT NULL
      AND char_length(btrim(ts.title)) BETWEEN 1 AND 120
      AND (
        src.id IS NULL
        OR src.canonical_session_id IS DISTINCT FROM cs.id
        OR src.team_id IS DISTINCT FROM ts.team_id
      )
  ) THEN
    RAISE EXCEPTION 'historical_training_session_mapping_incomplete_or_conflicting';
  END IF;
END;
$$;

-- Backfill eligible historical Scrim records without changing their source UUIDs.
INSERT INTO public.canonical_sessions (
  id, team_id, session_type, title, session_date, idempotency_key, created_by, created_at
)
SELECT
  md5('squad-os:legacy-scrim-record:' || sr.id::text)::uuid,
  sr.team_id,
  'scrim',
  'Scrim · ' || sr.scrim_date::text,
  sr.scrim_date,
  md5('squad-os:legacy-scrim-idempotency:' || sr.id::text)::uuid,
  sr.owner_id,
  sr.created_at
FROM public.scrim_records sr
WHERE sr.owner_id IS NOT NULL
  AND char_length(btrim('Scrim · ' || sr.scrim_date::text)) BETWEEN 1 AND 120
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.scrim_records sr
    JOIN public.canonical_sessions cs
      ON cs.id = md5('squad-os:legacy-scrim-record:' || sr.id::text)::uuid
    WHERE sr.owner_id IS NOT NULL
      AND (
        cs.team_id IS DISTINCT FROM sr.team_id
        OR cs.session_type IS DISTINCT FROM 'scrim'
        OR cs.session_date IS DISTINCT FROM sr.scrim_date
        OR cs.created_by IS DISTINCT FROM sr.owner_id
      )
  ) THEN
    RAISE EXCEPTION 'historical_scrim_canonical_identity_conflict';
  END IF;
END;
$$;

INSERT INTO public.canonical_session_sources (
  team_id, canonical_session_id, source_system, scrim_record_id, created_by
)
SELECT
  sr.team_id,
  md5('squad-os:legacy-scrim-record:' || sr.id::text)::uuid,
  'scrim',
  sr.id,
  sr.owner_id
FROM public.scrim_records sr
JOIN public.canonical_sessions cs
  ON cs.id = md5('squad-os:legacy-scrim-record:' || sr.id::text)::uuid
 AND cs.team_id = sr.team_id
WHERE sr.owner_id IS NOT NULL
ON CONFLICT (source_system, source_record_id) DO NOTHING;

-- Backfill eligible Tournament cycles as canonical tournament sessions.
INSERT INTO public.canonical_sessions (
  id, team_id, session_type, title, session_date, scheduled_at,
  idempotency_key, created_by, created_at
)
SELECT
  md5('squad-os:legacy-tournament-cycle:' || tc.id::text)::uuid,
  tc.team_id,
  'tournament',
  tc.title,
  tc.cycle_start,
  tc.registration_open_at,
  md5('squad-os:legacy-tournament-idempotency:' || tc.id::text)::uuid,
  tc.created_by,
  tc.created_at
FROM public.tournament_cycles tc
WHERE tc.created_by IS NOT NULL
  AND char_length(btrim(tc.title)) BETWEEN 1 AND 120
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tournament_cycles tc
    JOIN public.canonical_sessions cs
      ON cs.id = md5('squad-os:legacy-tournament-cycle:' || tc.id::text)::uuid
    WHERE tc.created_by IS NOT NULL
      AND char_length(btrim(tc.title)) BETWEEN 1 AND 120
      AND (
        cs.team_id IS DISTINCT FROM tc.team_id
        OR cs.session_type IS DISTINCT FROM 'tournament'
        OR cs.title IS DISTINCT FROM tc.title
        OR cs.session_date IS DISTINCT FROM tc.cycle_start
        OR cs.created_by IS DISTINCT FROM tc.created_by
      )
  ) THEN
    RAISE EXCEPTION 'historical_tournament_canonical_identity_conflict';
  END IF;
END;
$$;

INSERT INTO public.canonical_session_sources (
  team_id, canonical_session_id, source_system, tournament_cycle_id, created_by
)
SELECT
  tc.team_id,
  md5('squad-os:legacy-tournament-cycle:' || tc.id::text)::uuid,
  'tournament',
  tc.id,
  tc.created_by
FROM public.tournament_cycles tc
JOIN public.canonical_sessions cs
  ON cs.id = md5('squad-os:legacy-tournament-cycle:' || tc.id::text)::uuid
 AND cs.team_id = tc.team_id
WHERE tc.created_by IS NOT NULL
  AND char_length(btrim(tc.title)) BETWEEN 1 AND 120
ON CONFLICT (source_system, source_record_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.scrim_records sr
    LEFT JOIN public.canonical_session_sources src
      ON src.source_system = 'scrim' AND src.source_record_id = sr.id
    WHERE sr.owner_id IS NOT NULL
      AND (
        src.id IS NULL
        OR src.canonical_session_id IS DISTINCT FROM md5('squad-os:legacy-scrim-record:' || sr.id::text)::uuid
        OR src.team_id IS DISTINCT FROM sr.team_id
      )
  ) THEN
    RAISE EXCEPTION 'historical_scrim_session_mapping_incomplete_or_conflicting';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tournament_cycles tc
    LEFT JOIN public.canonical_session_sources src
      ON src.source_system = 'tournament' AND src.source_record_id = tc.id
    WHERE tc.created_by IS NOT NULL
      AND char_length(btrim(tc.title)) BETWEEN 1 AND 120
      AND (
        src.id IS NULL
        OR src.canonical_session_id IS DISTINCT FROM md5('squad-os:legacy-tournament-cycle:' || tc.id::text)::uuid
        OR src.team_id IS DISTINCT FROM tc.team_id
      )
  ) THEN
    RAISE EXCEPTION 'historical_tournament_session_mapping_incomplete_or_conflicting';
  END IF;
END;
$$;
