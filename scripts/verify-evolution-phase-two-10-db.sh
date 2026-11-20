#!/usr/bin/env bash
set -euo pipefail
: "\${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-two-9-db.sh"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.training_drills (
  id uuid PRIMARY KEY, team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  is_template boolean NOT NULL DEFAULT false, title text NOT NULL
);
ALTER TABLE public.training_sessions
  ADD COLUMN drill_id uuid REFERENCES public.training_drills(id) ON DELETE SET NULL;
CREATE TABLE public.practice_plan_blocks (
  id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.practice_plans(id) ON DELETE CASCADE,
  linked_drill_id uuid, sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE public.practice_tasks (
  id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.practice_plans(id) ON DELETE SET NULL,
  block_id uuid REFERENCES public.practice_plan_blocks(id) ON DELETE SET NULL,
  player_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  source_session_id uuid REFERENCES public.training_sessions(id) ON DELETE SET NULL
);
CREATE TABLE public.training_session_participants (
  id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  player_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE
);
CREATE TABLE public.training_results (
  id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  player_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  attempt_number integer NOT NULL
);
CREATE TABLE public.scrim_team_reviews (
  id uuid PRIMARY KEY, scrim_id uuid NOT NULL REFERENCES public.scrim_records(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE
);
INSERT INTO public.tournament_cycles(id,team_id,cycle_start,cycle_end,title,status,created_by)
VALUES ('bb100000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
 DATE '2026-11-24',DATE '2026-11-30','Bravo cycle','active','20000000-0000-0000-0000-000000000002');
INSERT INTO public.practice_plans(id,team_id,title,plan_date,plan_type,created_by)
VALUES
 ('bb100000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','Bravo plan',DATE '2026-11-24','daily','20000000-0000-0000-0000-000000000002'),
 ('aa100000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Alpha second plan',DATE '2026-11-25','daily','10000000-0000-0000-0000-000000000001');
INSERT INTO public.training_sessions(id,team_id,plan_id,title,session_type,scheduled_at,duration_minutes,instructions,created_by)
VALUES ('bb100000-0000-0000-0000-000000000004','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
 'bb100000-0000-0000-0000-000000000002','Bravo training','squad',NULL,30,'Fixture','20000000-0000-0000-0000-000000000002');
INSERT INTO public.training_drills(id,team_id,is_template,title) VALUES
 ('dd100000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false,'Alpha drill'),
 ('dd100000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false,'Bravo drill'),
 ('dd100000-0000-0000-0000-000000000003',NULL,true,'Global template');
INSERT INTO public.practice_plan_blocks(id,team_id,plan_id,linked_drill_id,sort_order) VALUES
 ('aa100000-0000-0000-0000-000000000010','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aa290000-0000-0000-0000-000000000003','dd100000-0000-0000-0000-000000000003',1),
 ('bb100000-0000-0000-0000-000000000011','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bb100000-0000-0000-0000-000000000002','dd100000-0000-0000-0000-000000000002',1),
 ('aa100000-0000-0000-0000-000000000012','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aa100000-0000-0000-0000-000000000003','dd100000-0000-0000-0000-000000000001',1);
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261121000000_evolution_phase_two_10_database_integrity.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $phase210$
DECLARE member_a uuid; member_b uuid;
BEGIN
  SELECT id INTO member_a FROM public.team_members WHERE team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND user_id='30000000-0000-0000-0000-000000000003';
  SELECT id INTO member_b FROM public.team_members WHERE team_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    AND user_id='20000000-0000-0000-0000-000000000002';

  BEGIN
    INSERT INTO public.tournament_matches(id,cycle_id,team_id,match_day,match_number,placement,kills,points,status)
    VALUES ('bb100000-0000-0000-0000-000000000020','aa290000-0000-0000-0000-000000000002',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',2,1,1,0,12,'draft');
    RAISE EXCEPTION 'cross-team tournament cycle accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.practice_plan_blocks(id,team_id,plan_id,sort_order)
    VALUES ('bb100000-0000-0000-0000-000000000021','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'aa290000-0000-0000-0000-000000000003',2);
    RAISE EXCEPTION 'cross-team plan block accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.training_sessions(id,team_id,plan_id,title,session_type,scheduled_at,duration_minutes,instructions,created_by)
    VALUES ('bb100000-0000-0000-0000-000000000022','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'aa290000-0000-0000-0000-000000000003','Bad plan link','squad',NULL,30,'Fixture',
      '20000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'cross-team training plan accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.practice_plan_blocks(id,team_id,plan_id,linked_drill_id,sort_order)
    VALUES ('aa100000-0000-0000-0000-000000000013','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aa290000-0000-0000-0000-000000000003','dd100000-0000-0000-0000-000000000002',2);
    RAISE EXCEPTION 'cross-team plan block drill accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.practice_plan_blocks(id,team_id,plan_id,linked_drill_id,sort_order)
    VALUES ('aa100000-0000-0000-0000-000000000014','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aa290000-0000-0000-0000-000000000003','dd100000-0000-0000-0000-000000000099',3);
    RAISE EXCEPTION 'missing plan block drill accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  INSERT INTO public.training_sessions(id,team_id,plan_id,drill_id,title,session_type,scheduled_at,duration_minutes,instructions,created_by)
  VALUES ('aa100000-0000-0000-0000-000000000030','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',NULL,
    'dd100000-0000-0000-0000-000000000003','Global template allowed','squad',NULL,30,'Fixture',
    '10000000-0000-0000-0000-000000000001');
  BEGIN
    INSERT INTO public.training_sessions(id,team_id,plan_id,drill_id,title,session_type,scheduled_at,duration_minutes,instructions,created_by)
    VALUES ('aa100000-0000-0000-0000-000000000031','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',NULL,
      'dd100000-0000-0000-0000-000000000002','Bad drill link','squad',NULL,30,'Fixture',
      '10000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'cross-team training drill accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.training_session_participants(id,team_id,session_id,player_member_id)
    VALUES ('aa100000-0000-0000-0000-000000000040','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bb100000-0000-0000-0000-000000000004',member_a);
    RAISE EXCEPTION 'cross-team participant session accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.training_session_participants(id,team_id,session_id,player_member_id)
    VALUES ('aa100000-0000-0000-0000-000000000041','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aa290000-0000-0000-0000-000000000021',member_b);
    RAISE EXCEPTION 'cross-team participant member accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.training_results(id,team_id,session_id,player_member_id,attempt_number)
    VALUES ('aa100000-0000-0000-0000-000000000050','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bb100000-0000-0000-0000-000000000004',member_a,1);
    RAISE EXCEPTION 'cross-team result session accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.training_results(id,team_id,session_id,player_member_id,attempt_number)
    VALUES ('aa100000-0000-0000-0000-000000000053','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aa290000-0000-0000-0000-000000000021',member_b,2);
    RAISE EXCEPTION 'cross-team result member accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  INSERT INTO public.training_results(id,team_id,session_id,player_member_id,attempt_number)
  VALUES ('aa100000-0000-0000-0000-000000000051','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aa290000-0000-0000-0000-000000000021',NULL,1);
  BEGIN
    INSERT INTO public.training_results(id,team_id,session_id,player_member_id,attempt_number)
    VALUES ('aa100000-0000-0000-0000-000000000052','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aa290000-0000-0000-0000-000000000021',NULL,1);
    RAISE EXCEPTION 'duplicate NULL-player attempt accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.practice_tasks(id,team_id,plan_id)
    VALUES ('aa100000-0000-0000-0000-000000000060','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bb100000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'cross-team task plan accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.practice_tasks(id,team_id,block_id)
    VALUES ('aa100000-0000-0000-0000-000000000064','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bb100000-0000-0000-0000-000000000011');
    RAISE EXCEPTION 'cross-team task block accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.practice_tasks(id,team_id,player_member_id)
    VALUES ('aa100000-0000-0000-0000-000000000061','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',member_b);
    RAISE EXCEPTION 'cross-team task member accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.practice_tasks(id,team_id,source_session_id)
    VALUES ('aa100000-0000-0000-0000-000000000062','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bb100000-0000-0000-0000-000000000004');
    RAISE EXCEPTION 'cross-team task source session accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.practice_tasks(id,team_id,plan_id,block_id)
    VALUES ('aa100000-0000-0000-0000-000000000063','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'aa290000-0000-0000-0000-000000000003','aa100000-0000-0000-0000-000000000012');
    RAISE EXCEPTION 'task block from another plan accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.scrim_team_reviews(id,scrim_id,team_id)
    VALUES ('aa100000-0000-0000-0000-000000000070','bb100000-0000-0000-0000-000000000002',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    RAISE EXCEPTION 'cross-team Scrim review accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  BEGIN
    UPDATE public.scrim_records SET matches='[{"placement":1,"kills":2}]'::jsonb
    WHERE id='aa290000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Scrim JSONB count mismatch accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    UPDATE public.training_drills SET team_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    WHERE id='dd100000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'referenced drill reassignment accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END
$phase210$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.tournament_matches'::regclass
    AND conname='tournament_matches_cycle_team_fk' AND convalidated) THEN
    RAISE EXCEPTION 'composite tournament FK is not validated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.training_results'::regclass
    AND conname='training_results_member_team_fk' AND convalidated) THEN
    RAISE EXCEPTION 'composite training result FK is not validated';
  END IF;
END $$;
SELECT 'Evolution Phase 2.10 PostgreSQL integrity integration PASS' AS verification;
SQL
