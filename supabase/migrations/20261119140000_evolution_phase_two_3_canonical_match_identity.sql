-- Evolution Phase Two.3 — Canonical Match Identity
-- Depends on Phase Two.2 canonical_sessions and canonical_session_sources.
-- Additive backfill only: existing source rows are retained and never rewritten.

-- Composite keys make source references tenant-safe.
CREATE UNIQUE INDEX IF NOT EXISTS scrim_records_id_team_canonical_uidx
  ON public.scrim_records (id, team_id);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_matches_id_team_canonical_uidx
  ON public.tournament_matches (id, team_id);

-- Refuse to create a misleading canonical mapping if a tournament match's team
-- differs from its parent tournament cycle.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tournament_matches tm
    JOIN public.tournament_cycles tc ON tc.id = tm.cycle_id
    WHERE tm.team_id <> tc.team_id
  ) THEN
    RAISE EXCEPTION 'phase_two_3_preflight_failed: tournament match team differs from parent cycle';
  END IF;
END $$;

-- Backfill parent canonical sessions for legacy Scrim records and Tournament
-- cycles that do not already have a source mapping. Deterministic idempotency
-- keys make a replay safe without relying on generated UUIDs.
INSERT INTO public.canonical_sessions (
  team_id, session_type, title, session_date, idempotency_key, created_by
)
SELECT
  sr.team_id,
  'scrim',
  left('Scrim · ' || sr.scrim_date::text, 120),
  sr.scrim_date,
  md5('evolution-v2-session:scrim:' || sr.id::text)::uuid,
  sr.owner_id
FROM public.scrim_records sr
WHERE NOT EXISTS (
  SELECT 1 FROM public.canonical_session_sources css
  WHERE css.source_system = 'scrim' AND css.scrim_record_id = sr.id
)
ON CONFLICT (team_id, idempotency_key) DO NOTHING;

INSERT INTO public.canonical_sessions (
  team_id, session_type, title, session_date, idempotency_key, created_by
)
SELECT
  tc.team_id,
  'tournament',
  left(coalesce(nullif(btrim(tc.title), ''), 'Tournament'), 120),
  tc.cycle_start,
  md5('evolution-v2-session:tournament:' || tc.id::text)::uuid,
  tc.created_by
FROM public.tournament_cycles tc
WHERE NOT EXISTS (
  SELECT 1 FROM public.canonical_session_sources css
  WHERE css.source_system = 'tournament' AND css.tournament_cycle_id = tc.id
)
ON CONFLICT (team_id, idempotency_key) DO NOTHING;

INSERT INTO public.canonical_session_sources (
  team_id, canonical_session_id, source_system, scrim_record_id, created_by
)
SELECT
  sr.team_id, cs.id, 'scrim', sr.id, sr.owner_id
FROM public.scrim_records sr
JOIN public.canonical_sessions cs
  ON cs.team_id = sr.team_id
 AND cs.idempotency_key = md5('evolution-v2-session:scrim:' || sr.id::text)::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.canonical_session_sources existing
  WHERE existing.source_system = 'scrim' AND existing.scrim_record_id = sr.id
)
ON CONFLICT DO NOTHING;

INSERT INTO public.canonical_session_sources (
  team_id, canonical_session_id, source_system, tournament_cycle_id, created_by
)
SELECT
  tc.team_id, cs.id, 'tournament', tc.id, tc.created_by
FROM public.tournament_cycles tc
JOIN public.canonical_sessions cs
  ON cs.team_id = tc.team_id
 AND cs.idempotency_key = md5('evolution-v2-session:tournament:' || tc.id::text)::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.canonical_session_sources existing
  WHERE existing.source_system = 'tournament' AND existing.tournament_cycle_id = tc.id
)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.canonical_session_match_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  source_system text NOT NULL CHECK (source_system IN ('scrim', 'tournament')),
  expected_match_count smallint NOT NULL CHECK (expected_match_count BETWEEN 0 AND 100),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_session_match_sets_session_team_fk
    FOREIGN KEY (canonical_session_id, team_id)
    REFERENCES public.canonical_sessions (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_sets_one_per_session UNIQUE (canonical_session_id),
  CONSTRAINT canonical_session_match_sets_id_team_unique UNIQUE (id, team_id)
);

CREATE TABLE IF NOT EXISTS public.canonical_session_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  match_sequence smallint NOT NULL CHECK (match_sequence BETWEEN 1 AND 100),
  source_system text NOT NULL CHECK (source_system IN ('scrim', 'tournament')),
  scrim_record_id uuid,
  scrim_source_sequence smallint,
  source_match_fingerprint text CHECK (
    source_match_fingerprint IS NULL OR source_match_fingerprint ~ '^[0-9a-f]{32}$'
  ),
  tournament_match_id uuid,
  source_match_day smallint,
  source_match_number smallint,
  map_name text CHECK (map_name IS NULL OR char_length(map_name) <= 120),
  mode text CHECK (mode IS NULL OR char_length(mode) <= 80),
  round_label text CHECK (round_label IS NULL OR char_length(round_label) <= 80),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_session_matches_session_team_fk
    FOREIGN KEY (canonical_session_id, team_id)
    REFERENCES public.canonical_sessions (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_matches_scrim_team_fk
    FOREIGN KEY (scrim_record_id, team_id)
    REFERENCES public.scrim_records (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_matches_tournament_team_fk
    FOREIGN KEY (tournament_match_id, team_id)
    REFERENCES public.tournament_matches (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_matches_source_shape CHECK (
    (
      source_system = 'scrim'
      AND scrim_record_id IS NOT NULL
      AND scrim_source_sequence BETWEEN 1 AND 100
      AND source_match_fingerprint IS NOT NULL
      AND tournament_match_id IS NULL
      AND source_match_day IS NULL
      AND source_match_number IS NULL
    )
    OR
    (
      source_system = 'tournament'
      AND scrim_record_id IS NULL
      AND scrim_source_sequence IS NULL
      AND source_match_fingerprint IS NULL
      AND tournament_match_id IS NOT NULL
      AND source_match_day BETWEEN 1 AND 7
      AND source_match_number BETWEEN 1 AND 6
    )
  ),
  CONSTRAINT canonical_session_matches_id_team_unique UNIQUE (id, team_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS canonical_session_matches_session_sequence_uidx
  ON public.canonical_session_matches (canonical_session_id, match_sequence);
CREATE UNIQUE INDEX IF NOT EXISTS canonical_session_matches_scrim_source_uidx
  ON public.canonical_session_matches (scrim_record_id, scrim_source_sequence)
  WHERE scrim_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS canonical_session_matches_tournament_source_uidx
  ON public.canonical_session_matches (tournament_match_id)
  WHERE tournament_match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS canonical_session_matches_team_session_idx
  ON public.canonical_session_matches (team_id, canonical_session_id, match_sequence);

CREATE TABLE IF NOT EXISTS public.canonical_session_match_sequence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_match_id uuid NOT NULL,
  previous_sequence smallint NOT NULL,
  new_sequence smallint NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  changed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_match_sequence_event_match_team_fk
    FOREIGN KEY (canonical_session_match_id, team_id)
    REFERENCES public.canonical_session_matches (id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_match_sequence_event_changed CHECK (previous_sequence <> new_sequence)
);

CREATE INDEX IF NOT EXISTS canonical_match_sequence_events_match_time_idx
  ON public.canonical_session_match_sequence_events (canonical_session_match_id, changed_at DESC);

-- Expected counts are derived only from existing source metadata. No missing
-- Scrim array entries or absent Tournament slots are generated.
INSERT INTO public.canonical_session_match_sets (
  team_id, canonical_session_id, source_system, expected_match_count, created_by
)
SELECT cs.team_id, cs.id, 'scrim', sr.match_count, cs.created_by
FROM public.canonical_session_sources css
JOIN public.canonical_sessions cs
  ON cs.id = css.canonical_session_id AND cs.team_id = css.team_id
JOIN public.scrim_records sr
  ON sr.id = css.scrim_record_id AND sr.team_id = css.team_id
WHERE css.source_system = 'scrim'
ON CONFLICT (canonical_session_id) DO NOTHING;

INSERT INTO public.canonical_session_match_sets (
  team_id, canonical_session_id, source_system, expected_match_count, created_by
)
SELECT cs.team_id, cs.id, 'tournament', count(tm.id)::smallint, cs.created_by
FROM public.canonical_session_sources css
JOIN public.canonical_sessions cs
  ON cs.id = css.canonical_session_id AND cs.team_id = css.team_id
JOIN public.tournament_cycles tc
  ON tc.id = css.tournament_cycle_id AND tc.team_id = css.team_id
LEFT JOIN public.tournament_matches tm
  ON tm.cycle_id = tc.id AND tm.team_id = tc.team_id
WHERE css.source_system = 'tournament'
GROUP BY cs.team_id, cs.id, cs.created_by
ON CONFLICT (canonical_session_id) DO NOTHING;

-- Scrim JSONB elements have no source UUID. Preserve the parent record,
-- original one-based array sequence and a content fingerprint as provenance.
INSERT INTO public.canonical_session_matches (
  team_id, canonical_session_id, match_sequence, source_system,
  scrim_record_id, scrim_source_sequence, source_match_fingerprint,
  map_name, mode, round_label, created_by
)
SELECT
  cs.team_id, cs.id, item.ordinality::smallint, 'scrim',
  sr.id, item.ordinality::smallint, md5(item.value::text),
  nullif(item.value->>'map_name', ''),
  nullif(item.value->>'mode', ''),
  nullif(item.value->>'round_label', ''),
  cs.created_by
FROM public.canonical_session_sources css
JOIN public.canonical_sessions cs
  ON cs.id = css.canonical_session_id AND cs.team_id = css.team_id
JOIN public.scrim_records sr
  ON sr.id = css.scrim_record_id AND sr.team_id = css.team_id
CROSS JOIN LATERAL jsonb_array_elements(sr.matches) WITH ORDINALITY AS item(value, ordinality)
WHERE css.source_system = 'scrim'
ON CONFLICT DO NOTHING;

-- Tournament source rows already have stable UUIDs. The global sequence is
-- derived from the existing day + match number; those source coordinates are
-- also retained separately for exact traceability.
INSERT INTO public.canonical_session_matches (
  team_id, canonical_session_id, match_sequence, source_system,
  tournament_match_id, source_match_day, source_match_number,
  map_name, created_by
)
SELECT
  cs.team_id, cs.id,
  ((tm.match_day - 1) * 6 + tm.match_number)::smallint,
  'tournament',
  tm.id, tm.match_day, tm.match_number,
  tm.map_name, cs.created_by
FROM public.canonical_session_sources css
JOIN public.canonical_sessions cs
  ON cs.id = css.canonical_session_id AND cs.team_id = css.team_id
JOIN public.tournament_cycles tc
  ON tc.id = css.tournament_cycle_id AND tc.team_id = css.team_id
JOIN public.tournament_matches tm
  ON tm.cycle_id = tc.id AND tm.team_id = tc.team_id
WHERE css.source_system = 'tournament'
ON CONFLICT DO NOTHING;

-- Count actual played matches from source facts, not from expected slots.
-- Scrim JSONB entries are recorded played matches. Tournament rows count as
-- played only after a submitted/verified/disputed result state exists.
CREATE OR REPLACE VIEW public.canonical_session_match_counts
WITH (security_invoker = true)
AS
SELECT
  cs.id AS canonical_session_id,
  cs.team_id,
  cs.session_type,
  sets.expected_match_count,
  count(matches.id)::integer AS canonical_match_record_count,
  count(matches.id) FILTER (
    WHERE (
      matches.source_system = 'scrim'
      AND EXISTS (
        SELECT 1 FROM public.scrim_records sr
        WHERE sr.id = matches.scrim_record_id AND sr.team_id = matches.team_id
          AND jsonb_array_length(sr.matches) >= matches.scrim_source_sequence
          AND md5((sr.matches -> (matches.scrim_source_sequence - 1))::text)
            = matches.source_match_fingerprint
      )
    )
    OR (
      matches.source_system = 'tournament'
      AND tournament_matches.status IN ('submitted', 'verified', 'disputed')
    )
  )::integer AS actual_played_match_count
FROM public.canonical_sessions cs
LEFT JOIN public.canonical_session_match_sets sets
  ON sets.canonical_session_id = cs.id AND sets.team_id = cs.team_id
LEFT JOIN public.canonical_session_matches matches
  ON matches.canonical_session_id = cs.id AND matches.team_id = cs.team_id
LEFT JOIN public.tournament_matches
  ON public.tournament_matches.id = matches.tournament_match_id
 AND public.tournament_matches.team_id = matches.team_id
GROUP BY cs.id, cs.team_id, cs.session_type, sets.expected_match_count;

ALTER TABLE public.canonical_session_match_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_match_sequence_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.canonical_session_match_sets,
  public.canonical_session_matches,
  public.canonical_session_match_sequence_events FROM anon, authenticated;
GRANT SELECT ON public.canonical_session_match_sets,
  public.canonical_session_matches,
  public.canonical_session_match_sequence_events TO authenticated;
GRANT INSERT ON public.canonical_session_match_sets,
  public.canonical_session_matches TO authenticated;
GRANT UPDATE (expected_match_count) ON public.canonical_session_match_sets TO authenticated;
GRANT UPDATE (match_sequence) ON public.canonical_session_matches TO authenticated;
GRANT SELECT ON public.canonical_session_match_counts TO authenticated;
REVOKE DELETE ON public.canonical_session_match_sets,
  public.canonical_session_matches,
  public.canonical_session_match_sequence_events FROM anon, authenticated;

CREATE POLICY canonical_session_match_sets_team_read
  ON public.canonical_session_match_sets FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = canonical_session_match_sets.team_id
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
  ));
CREATE POLICY canonical_session_match_sets_staff_insert
  ON public.canonical_session_match_sets FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.team_members actor
      WHERE actor.team_id = canonical_session_match_sets.team_id
        AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
        AND actor.membership_role IN ('owner', 'coach')
    )
    AND (
      (
        source_system = 'scrim'
        AND EXISTS (
          SELECT 1 FROM public.canonical_session_sources css
          JOIN public.scrim_records sr
            ON sr.id = css.scrim_record_id AND sr.team_id = css.team_id
          WHERE css.canonical_session_id = canonical_session_match_sets.canonical_session_id
            AND css.team_id = canonical_session_match_sets.team_id
            AND css.source_system = 'scrim'
            AND sr.match_count = canonical_session_match_sets.expected_match_count
            AND EXISTS (
              SELECT 1 FROM public.canonical_sessions cs
              WHERE cs.id = canonical_session_match_sets.canonical_session_id
                AND cs.team_id = canonical_session_match_sets.team_id
                AND cs.session_type = 'scrim'
            )
        )
      )
      OR
      (
        source_system = 'tournament'
        AND EXISTS (
          SELECT 1 FROM public.canonical_session_sources css
          JOIN public.canonical_sessions cs
            ON cs.id = css.canonical_session_id AND cs.team_id = css.team_id
          WHERE css.canonical_session_id = canonical_session_match_sets.canonical_session_id
            AND css.team_id = canonical_session_match_sets.team_id
            AND css.source_system = 'tournament'
            AND cs.session_type = 'tournament'
            AND (
              SELECT count(*) FROM public.tournament_matches tm
              WHERE tm.cycle_id = css.tournament_cycle_id AND tm.team_id = css.team_id
            ) = canonical_session_match_sets.expected_match_count
        )
      )
    )
  );

CREATE POLICY canonical_session_match_sets_staff_update
  ON public.canonical_session_match_sets FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_match_sets.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner', 'coach')
  ))
  WITH CHECK (
    (
      (
        source_system = 'scrim'
        AND EXISTS (
          SELECT 1 FROM public.canonical_session_sources css
          JOIN public.scrim_records sr
            ON sr.id = css.scrim_record_id AND sr.team_id = css.team_id
          JOIN public.canonical_sessions cs
            ON cs.id = css.canonical_session_id AND cs.team_id = css.team_id
          WHERE css.canonical_session_id = canonical_session_match_sets.canonical_session_id
            AND css.team_id = canonical_session_match_sets.team_id
            AND css.source_system = 'scrim'
            AND cs.session_type = 'scrim'
            AND sr.match_count = canonical_session_match_sets.expected_match_count
        )
      )
      OR
      (
        source_system = 'tournament'
        AND EXISTS (
          SELECT 1 FROM public.canonical_session_sources css
          JOIN public.canonical_sessions cs
            ON cs.id = css.canonical_session_id AND cs.team_id = css.team_id
          WHERE css.canonical_session_id = canonical_session_match_sets.canonical_session_id
            AND css.team_id = canonical_session_match_sets.team_id
            AND css.source_system = 'tournament'
            AND cs.session_type = 'tournament'
            AND (
              SELECT count(*) FROM public.tournament_matches tm
              WHERE tm.cycle_id = css.tournament_cycle_id AND tm.team_id = css.team_id
            ) = canonical_session_match_sets.expected_match_count
        )
      )
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_match_sets.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner', 'coach')
  );

CREATE POLICY canonical_session_matches_team_read
  ON public.canonical_session_matches FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = canonical_session_matches.team_id
      AND tm.user_id = (SELECT auth.uid()) AND tm.status = 'active'
  ));
CREATE POLICY canonical_session_matches_staff_insert
  ON public.canonical_session_matches FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.team_members actor
      WHERE actor.team_id = canonical_session_matches.team_id
        AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
        AND actor.membership_role IN ('owner', 'coach')
    )
    AND EXISTS (
      SELECT 1 FROM public.canonical_sessions cs
      WHERE cs.id = canonical_session_matches.canonical_session_id
        AND cs.team_id = canonical_session_matches.team_id
        AND cs.session_type = canonical_session_matches.source_system
        AND cs.archived_at IS NULL
    )
    AND (
      (
        source_system = 'scrim'
        AND EXISTS (
          SELECT 1 FROM public.canonical_session_sources css
          JOIN public.scrim_records sr
            ON sr.id = css.scrim_record_id AND sr.team_id = css.team_id
          WHERE css.canonical_session_id = canonical_session_matches.canonical_session_id
            AND css.team_id = canonical_session_matches.team_id
            AND css.source_system = 'scrim'
            AND css.scrim_record_id = canonical_session_matches.scrim_record_id
            AND jsonb_array_length(sr.matches) >= canonical_session_matches.scrim_source_sequence
            AND md5((sr.matches -> (canonical_session_matches.scrim_source_sequence - 1))::text)
              = canonical_session_matches.source_match_fingerprint
        )
      )
      OR
      (
        source_system = 'tournament'
        AND EXISTS (
          SELECT 1 FROM public.canonical_session_sources css
          JOIN public.tournament_matches tm
            ON tm.id = canonical_session_matches.tournament_match_id
           AND tm.team_id = css.team_id
           AND tm.cycle_id = css.tournament_cycle_id
          WHERE css.canonical_session_id = canonical_session_matches.canonical_session_id
            AND css.team_id = canonical_session_matches.team_id
            AND css.source_system = 'tournament'
            AND tm.match_day = canonical_session_matches.source_match_day
            AND tm.match_number = canonical_session_matches.source_match_number
        )
      )
    )
  );
CREATE POLICY canonical_session_matches_staff_update
  ON public.canonical_session_matches FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_matches.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner', 'coach')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_matches.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner', 'coach')
  ));

CREATE POLICY canonical_session_match_sequence_events_staff_read
  ON public.canonical_session_match_sequence_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_match_sequence_events.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner', 'coach')
  ));

-- The audit trigger is private, narrowly scoped, and not directly executable
-- by API roles. Sequence corrections always emit an actor/time/reason record.
CREATE SCHEMA IF NOT EXISTS evolution_private;
REVOKE ALL ON SCHEMA evolution_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.audit_canonical_match_sequence_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match public.canonical_session_matches;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
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

  PERFORM set_config('app.evolution_match_sequence_reason', btrim(p_reason), true);
  UPDATE public.canonical_session_matches
  SET match_sequence = p_new_sequence
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.correct_canonical_match_sequence(uuid, smallint, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_canonical_match_sequence(uuid, smallint, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_canonical_session_matches(p_canonical_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.canonical_sessions;
  v_inserted integer := 0;
  v_rows integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO v_session
  FROM public.canonical_sessions
  WHERE id = p_canonical_session_id AND archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_session.team_id AND tm.user_id = auth.uid()
      AND tm.status = 'active' AND tm.membership_role IN ('owner', 'coach')
  ) THEN
    RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.canonical_session_match_sets (
    team_id, canonical_session_id, source_system, expected_match_count, created_by
  )
  SELECT v_session.team_id, v_session.id, 'scrim', sr.match_count, auth.uid()
  FROM public.canonical_session_sources css
  JOIN public.scrim_records sr
    ON sr.id = css.scrim_record_id AND sr.team_id = css.team_id
  WHERE css.canonical_session_id = v_session.id AND css.team_id = v_session.team_id
    AND css.source_system = 'scrim'
  ON CONFLICT (canonical_session_id) DO UPDATE
  SET expected_match_count = EXCLUDED.expected_match_count;

  INSERT INTO public.canonical_session_matches (
    team_id, canonical_session_id, match_sequence, source_system,
    scrim_record_id, scrim_source_sequence, source_match_fingerprint,
    map_name, mode, round_label, created_by
  )
  SELECT
    v_session.team_id, v_session.id, item.ordinality::smallint, 'scrim',
    sr.id, item.ordinality::smallint, md5(item.value::text),
    nullif(item.value->>'map_name', ''),
    nullif(item.value->>'mode', ''),
    nullif(item.value->>'round_label', ''),
    auth.uid()
  FROM public.canonical_session_sources css
  JOIN public.scrim_records sr
    ON sr.id = css.scrim_record_id AND sr.team_id = css.team_id
  CROSS JOIN LATERAL jsonb_array_elements(sr.matches) WITH ORDINALITY AS item(value, ordinality)
  WHERE css.canonical_session_id = v_session.id AND css.team_id = v_session.team_id
    AND css.source_system = 'scrim'
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  INSERT INTO public.canonical_session_match_sets (
    team_id, canonical_session_id, source_system, expected_match_count, created_by
  )
  SELECT v_session.team_id, v_session.id, 'tournament',
    (SELECT count(*) FROM public.tournament_matches tm
      WHERE tm.cycle_id = css.tournament_cycle_id AND tm.team_id = css.team_id)::smallint,
    auth.uid()
  FROM public.canonical_session_sources css
  WHERE css.canonical_session_id = v_session.id AND css.team_id = v_session.team_id
    AND css.source_system = 'tournament'
  ON CONFLICT (canonical_session_id) DO UPDATE
  SET expected_match_count = EXCLUDED.expected_match_count;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;

  INSERT INTO public.canonical_session_matches (
    team_id, canonical_session_id, match_sequence, source_system,
    tournament_match_id, source_match_day, source_match_number, map_name, created_by
  )
  SELECT
    v_session.team_id, v_session.id,
    ((tm.match_day - 1) * 6 + tm.match_number)::smallint,
    'tournament', tm.id, tm.match_day, tm.match_number, tm.map_name, auth.uid()
  FROM public.canonical_session_sources css
  JOIN public.tournament_matches tm
    ON tm.cycle_id = css.tournament_cycle_id AND tm.team_id = css.team_id
  WHERE css.canonical_session_id = v_session.id AND css.team_id = v_session.team_id
    AND css.source_system = 'tournament'
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_inserted := v_inserted + v_rows;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_canonical_session_matches(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_canonical_session_matches(uuid) TO authenticated;

COMMENT ON TABLE public.canonical_session_matches IS
  'Stable first-class match UUIDs under a canonical session. Scrim source uses parent record + original JSONB array sequence/fingerprint; Tournament source uses its existing match UUID.';
COMMENT ON TABLE public.canonical_session_match_sets IS
  'Expected match count derived from existing Scrim match_count or existing Tournament match rows. It does not create missing match rows.';
COMMENT ON VIEW public.canonical_session_match_counts IS
  'Expected vs actual played match counts. Tournament matches count as played only when their source status is submitted, verified or disputed.';
COMMENT ON TABLE public.canonical_session_match_sequence_events IS
  'Append-only audit of canonical match sequence corrections.';
