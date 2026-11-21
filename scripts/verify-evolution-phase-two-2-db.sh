#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to the disposable CI PostgreSQL service}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261119120000_evolution_phase_two_2_canonical_session_identity.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.teams (id uuid PRIMARY KEY, team_name text NOT NULL);
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  membership_role text NOT NULL,
  status text NOT NULL
);
GRANT SELECT ON public.team_members TO authenticated;

CREATE TABLE public.scrim_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id)
);
CREATE TABLE public.tournament_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id)
);
CREATE TABLE public.training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  title text NOT NULL,
  session_type text NOT NULL DEFAULT 'individual',
  scheduled_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 15,
  status text NOT NULL DEFAULT 'scheduled',
  instructions text NOT NULL DEFAULT '',
  coach_notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
INSERT INTO auth.users(id) VALUES
 ('10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003');
INSERT INTO public.teams(id, team_name) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Alpha'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Bravo');
INSERT INTO public.training_sessions(
 id,team_id,title,session_type,scheduled_at,duration_minutes,created_by
) VALUES (
 'aaaaaaaa-1111-1111-1111-111111111111',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'Historical Training Session','squad',TIMESTAMPTZ '2026-11-20 12:00:00+05:30',30,
 '10000000-0000-0000-0000-000000000001'
);
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
# A second application must leave the deterministic historical mapping unchanged.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public.team_members(team_id,user_id,membership_role,status) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','10000000-0000-0000-0000-000000000001','owner','active'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','20000000-0000-0000-0000-000000000002','owner','active'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','30000000-0000-0000-0000-000000000003','player','active');
INSERT INTO public.scrim_records(id,team_id) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

DO $
DECLARE
  legacy_id uuid := 'aaaaaaaa-1111-1111-1111-111111111111';
  mapped_id uuid;
  mapped_count integer;
BEGIN
  SELECT cs.id INTO mapped_id
  FROM public.canonical_session_sources src
  JOIN public.canonical_sessions cs ON cs.id=src.canonical_session_id
  WHERE src.source_system='training' AND src.source_record_id=legacy_id;
  IF mapped_id IS NULL THEN RAISE EXCEPTION 'historical training session was not mapped'; END IF;
  IF mapped_id = legacy_id THEN RAISE EXCEPTION 'historical legacy UUID was unexpectedly replaced as canonical identity'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.training_sessions
    WHERE id=legacy_id AND title='Historical Training Session'
  ) THEN RAISE EXCEPTION 'historical training session was rewritten or removed'; END IF;
  SELECT count(*) INTO mapped_count FROM public.canonical_session_sources WHERE source_system='training';
  IF mapped_count <> 1 THEN RAISE EXCEPTION 'historical source mapping duplicated after migration replay'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.canonical_sessions
    WHERE id=mapped_id AND season_label IS NOT NULL
  ) THEN RAISE EXCEPTION 'historical season was fabricated';
  END IF;
END $;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);

DO $$
DECLARE
  first_session public.canonical_sessions;
  retry_session public.canonical_sessions;
  second_session public.canonical_sessions;
  visible_count integer;
  changed_count integer;
BEGIN
  first_session := public.create_canonical_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','scrim','Friday Scrim',
    '11111111-1111-1111-1111-111111111111',DATE '2026-11-20',NULL,'Season 2026'
  );
  retry_session := public.create_canonical_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','scrim','Friday Scrim',
    '11111111-1111-1111-1111-111111111111',DATE '2026-11-20',NULL,'Season 2026'
  );
  IF first_session.id <> retry_session.id THEN
    RAISE EXCEPTION 'idempotent retry created a second session';
  END IF;

  BEGIN
    PERFORM public.create_canonical_session(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','scrim','Different payload',
      '11111111-1111-1111-1111-111111111111',DATE '2026-11-20',NULL,'Season 2026'
    );
    RAISE EXCEPTION 'reused idempotency key with changed payload was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  INSERT INTO public.canonical_session_sources(
    team_id,canonical_session_id,source_system,scrim_record_id,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',first_session.id,'scrim',
    'aaaaaaaa-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'
  );

  second_session := public.create_canonical_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','scrim','Second Scrim',
    '33333333-3333-3333-3333-333333333333',DATE '2026-11-21',NULL,'Season 2026'
  );

  BEGIN
    INSERT INTO public.canonical_session_sources(
      team_id,canonical_session_id,source_system,scrim_record_id,created_by
    ) VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',second_session.id,'scrim',
      'bbbbbbbb-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'cross-team source mapping was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  SELECT count(*) INTO visible_count FROM public.canonical_sessions;
  IF visible_count <> 2 THEN RAISE EXCEPTION 'team RLS returned % rows, expected 2', visible_count; END IF;

  UPDATE public.canonical_sessions
  SET archived_at = now(), archived_by = auth.uid(), archive_reason = 'completed'
  WHERE id = first_session.id;
  UPDATE public.canonical_sessions SET title = 'Should not change' WHERE id = first_session.id;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN RAISE EXCEPTION 'archived session remained mutable'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_canonical_session(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','training','Player forbidden',
      '22222222-2222-2222-2222-222222222222'
    );
    RAISE EXCEPTION 'player role created a canonical session';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
DO $$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.canonical_sessions;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'cross-team session visibility leaked'; END IF;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.canonical_sessions','DELETE') THEN
    RAISE EXCEPTION 'authenticated role unexpectedly has DELETE on canonical_sessions';
  END IF;
  IF has_table_privilege('authenticated','public.canonical_session_sources','DELETE') THEN
    RAISE EXCEPTION 'authenticated role unexpectedly has DELETE on canonical_session_sources';
  END IF;
END $$;

SELECT 'Evolution Phase 2.2 PostgreSQL integration PASS' AS result;
SQL
