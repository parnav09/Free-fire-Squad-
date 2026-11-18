#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_MIGRATION="$ROOT/supabase/migrations/20261119120000_evolution_phase_two_2_canonical_session_identity.sql"
PHASE_MIGRATION="$ROOT/supabase/migrations/20261119130000_evolution_phase_three_evidence_rubric_scoring.sql"

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
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  membership_role text NOT NULL,
  status text NOT NULL
);
GRANT SELECT ON public.team_members TO authenticated;

CREATE TABLE public.scrim_records (id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES public.teams(id));
CREATE TABLE public.tournament_cycles (id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES public.teams(id));
CREATE TABLE public.training_sessions (id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES public.teams(id));
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SESSION_MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$PHASE_MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO auth.users(id) VALUES
 ('10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003');
INSERT INTO public.teams(id,team_name) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Alpha'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Bravo');
INSERT INTO public.team_members(id,team_id,user_id,membership_role,status) VALUES
 ('a1000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','10000000-0000-0000-0000-000000000001','owner','active'),
 ('a2000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','20000000-0000-0000-0000-000000000002','player','active'),
 ('b3000000-0000-0000-0000-000000000003','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','30000000-0000-0000-0000-000000000003','owner','active');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  version_id uuid;
  dimension_id uuid;
  profile_id uuid;
  session_row public.canonical_sessions;
  dimension_count integer;
BEGIN
  SELECT id INTO version_id FROM public.evolution_rubric_versions
  WHERE is_system AND version_code='EV2-1.0' AND status='active';
  IF version_id IS NULL THEN RAISE EXCEPTION 'system rubric seed missing'; END IF;
  SELECT count(*) INTO dimension_count FROM public.evolution_rubric_dimensions
  WHERE rubric_version_id=version_id;
  IF dimension_count <> 6 THEN RAISE EXCEPTION 'system rubric has % dimensions, expected 6',dimension_count; END IF;
  SELECT count(*) INTO dimension_count FROM public.evolution_role_weight_profiles
  WHERE rubric_version_id=version_id AND is_system AND status='active';
  IF dimension_count <> 6 THEN RAISE EXCEPTION 'system neutral role profile count %, expected 6',dimension_count; END IF;

  session_row := public.create_canonical_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','scrim','Phase Three Evidence Session',
    '11111111-1111-1111-1111-111111111111',DATE '2026-11-19',NULL,'Season 2026'
  );

  INSERT INTO public.evolution_rubric_versions(
    team_id,version_code,title,status,scoring_engine_version,minimum_observed_dimensions,
    is_system,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','TEAM-1.0','Team Rubric Draft','draft',
    'score-1.0',4,false,auth.uid()
  ) RETURNING id INTO version_id;

  INSERT INTO public.evolution_rubric_dimensions(
    rubric_version_id,dimension_key,label,definition,sort_order
  )
  SELECT version_id,d.key,d.label,d.definition,d.position
  FROM (VALUES
    ('communication','Communication','Clear and timely information.',1),
    ('coordination_trade_support','Coordination & Trade Support','Team coordination and support.',2),
    ('decision_making','Decision Making','Decision quality in context.',3),
    ('positioning','Positioning','Cover, spacing and angles.',4),
    ('map_awareness_rotation','Map Awareness & Rotation','Map and zone context.',5),
    ('role_execution','Role Execution','Execution of the recorded role.',6)
  ) AS d(key,label,definition,position);

  UPDATE public.evolution_rubric_versions
  SET status='active',activated_at=now()
  WHERE id=version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'complete team rubric did not activate'; END IF;

  INSERT INTO public.evolution_role_weight_profiles(
    team_id,rubric_version_id,role_key,version_code,weights,is_system,status,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',version_id,'primary_rusher','team-neutral-1.0',
    '{"communication":1,"coordination_trade_support":1,"decision_making":1,"positioning":1,"map_awareness_rotation":1,"role_execution":1}',
    false,'draft',auth.uid()
  ) RETURNING id INTO profile_id;
  UPDATE public.evolution_role_weight_profiles SET status='active',activated_at=now()
  WHERE id=profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'team role profile did not activate'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
DO $$
DECLARE
  session_id uuid;
  dim_id uuid;
  visible_count integer;
  evidence_id uuid;
BEGIN
  SELECT id INTO session_id FROM public.canonical_sessions
  WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  SELECT d.id INTO dim_id
  FROM public.evolution_rubric_dimensions d
  JOIN public.evolution_rubric_versions v ON v.id=d.rubric_version_id
  WHERE v.is_system AND v.version_code='EV2-1.0' AND d.dimension_key='communication';

  INSERT INTO public.evolution_evidence_items(
    team_id,canonical_session_id,player_member_id,source_type,visibility,title,description,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',session_id,
    'a2000000-0000-0000-0000-000000000002','manual_observation','team',
    'Team-visible observation','A specific observed behavior.',auth.uid()
  ) RETURNING id INTO evidence_id;

  INSERT INTO public.evolution_evidence_dimension_links(
    team_id,evidence_item_id,rubric_version_id,rubric_dimension_id,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',evidence_id,
    (SELECT rubric_version_id FROM public.evolution_rubric_dimensions WHERE id=dim_id),
    dim_id,auth.uid()
  );

  INSERT INTO public.evolution_evidence_items(
    team_id,canonical_session_id,player_member_id,source_type,visibility,title,description,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',session_id,
    'a2000000-0000-0000-0000-000000000002','round_note','private',
    'Private note','Private evidence belongs to its author.',auth.uid()
  );
  SELECT count(*) INTO visible_count FROM public.evolution_evidence_items;
  IF visible_count <> 2 THEN RAISE EXCEPTION 'author should see both own evidence items, saw %',visible_count; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.evolution_evidence_items;
  IF visible_count <> 1 THEN RAISE EXCEPTION 'coach should see only team-visible evidence, saw %',visible_count; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
DO $$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.evolution_evidence_items;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'cross-team evidence visibility leaked'; END IF;
  SELECT count(*) INTO visible_count FROM public.evolution_rubric_versions
  WHERE NOT is_system;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'cross-team rubric visibility leaked'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE evidence_id uuid;
BEGIN
  SELECT id INTO evidence_id FROM public.evolution_evidence_items
  WHERE visibility='team';
  UPDATE public.evolution_evidence_items
  SET archived_at=now(),archived_by=auth.uid(),archive_reason='Archived by coach'
  WHERE id=evidence_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'coach could not archive team evidence'; END IF;
  IF EXISTS (SELECT 1 FROM public.evolution_evidence_items WHERE id=evidence_id) THEN
    RAISE EXCEPTION 'archived evidence remained in active read view';
  END IF;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.evolution_evidence_items','DELETE') THEN
    RAISE EXCEPTION 'authenticated role unexpectedly has evidence DELETE';
  END IF;
  IF has_table_privilege('authenticated','public.evolution_rubric_versions','DELETE') THEN
    RAISE EXCEPTION 'authenticated role unexpectedly has rubric DELETE';
  END IF;
  IF has_table_privilege('anon','public.evolution_evidence_items','SELECT') THEN
    RAISE EXCEPTION 'anon role unexpectedly has evidence SELECT';
  END IF;
END $$;

SELECT 'Evolution Phase Three PostgreSQL integration PASS' AS result;
SQL
