#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIMENSION_MIGRATION="$ROOT/supabase/migrations/20261122130000_evolution_phase_three_2_canonical_dimension_registry.sql"
EVIDENCE_MIGRATION="$ROOT/supabase/migrations/20261122140000_evolution_phase_three_3_evidence_data_model.sql"

# Build the exact disposable Phase 2.2–2.6 dependency chain and its canonical
# fixtures. This does not connect to or mutate a production database.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-two-6-db.sh"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DIMENSION_MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$EVIDENCE_MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$EVIDENCE_MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session uuid;
  v_match uuid;
  v_role uuid;
  v_user uuid;
  v_member uuid;
  v_context uuid;
  v_evidence uuid;
  v_dimension_version integer;
  v_version_count integer;
BEGIN
  SELECT cs.id INTO v_session
  FROM public.canonical_sessions cs
  WHERE cs.title='Role Snapshot Test' AND cs.team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF v_session IS NULL THEN RAISE EXCEPTION 'canonical Phase 2.6 session fixture missing'; END IF;

  SELECT r.id, r.canonical_session_match_id, r.player_user_id, tm.id
  INTO v_role, v_match, v_user, v_member
  FROM public.canonical_session_match_roles r
  JOIN public.team_members tm
    ON tm.team_id=r.team_id AND tm.user_id=r.player_user_id
  WHERE r.team_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND r.canonical_session_id=v_session
  ORDER BY r.changed_at
  LIMIT 1;
  IF v_role IS NULL OR v_member IS NULL THEN
    RAISE EXCEPTION 'canonical match role snapshot fixture missing';
  END IF;

  INSERT INTO public.evolution_evaluation_contexts(
    team_id,player_member_id,player_user_id,canonical_session_id,
    canonical_session_match_id,role_assignment_id,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_member,v_user,v_session,
    v_match,v_role,auth.uid()
  ) RETURNING id INTO v_context;

  INSERT INTO public.evolution_evidence_items(
    team_id,evaluation_context_id,visibility,source_type,title,observation,
    occurred_at,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_context,'team',
    'manual_observation','Rotation timing','Player called the move before the zone closed.',
    clock_timestamp(),auth.uid()
  ) RETURNING id INTO v_evidence;

  SELECT definition_version INTO v_dimension_version
  FROM public.evolution_dimension_definition_versions
  WHERE dimension_key='communication' AND definition_version=1;
  IF v_dimension_version IS NULL THEN RAISE EXCEPTION 'canonical dimension version 1 missing'; END IF;

  INSERT INTO public.evolution_evidence_dimension_links(
    team_id,evidence_item_id,dimension_key,definition_version,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_evidence,
    'communication',v_dimension_version,auth.uid()
  );

  SELECT count(*) INTO v_version_count
  FROM public.evolution_evidence_versions WHERE evidence_item_id=v_evidence;
  IF v_version_count <> 1 THEN
    RAISE EXCEPTION 'initial evidence version was not seeded atomically; count=%',v_version_count;
  END IF;

  INSERT INTO public.evolution_evidence_versions(
    team_id,evidence_item_id,version_number,source_type,title,observation,
    created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_evidence,2,
    'manual_observation','Rotation timing corrected',
    'The call was made before the team crossed the ridge.',auth.uid()
  );

  SELECT count(*) INTO v_version_count
  FROM public.evolution_evidence_versions WHERE evidence_item_id=v_evidence;
  IF v_version_count <> 2 THEN RAISE EXCEPTION 'append-only correction history missing'; END IF;

  BEGIN
    UPDATE public.evolution_evidence_versions SET title='Mutated history'
    WHERE evidence_item_id=v_evidence AND version_number=1;
    RAISE EXCEPTION 'evidence version mutation unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' OR insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.evolution_evidence_versions(
      team_id,evidence_item_id,version_number,source_type,title,observation,created_by
    ) VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_evidence,4,
      'manual_observation','Skipped version','This version number must fail.',auth.uid()
    );
    RAISE EXCEPTION 'non-sequential evidence version unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.evolution_evidence_items(
      team_id,evaluation_context_id,visibility,source_type,title,observation,created_by
    ) VALUES (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',v_context,'team',
      'manual_observation','Cross-team','Invalid context ownership.',auth.uid()
    );
    RAISE EXCEPTION 'cross-team context reference unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.evolution_evidence_items(
      team_id,evaluation_context_id,visibility,source_type,title,observation,created_by
    ) VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_context,'team',
      'vod_reference','Missing locator','VOD references require a URL.',auth.uid()
    );
    RAISE EXCEPTION 'VOD reference without locator unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A second private item proves visibility is not inferred from coach status.
  INSERT INTO public.evolution_evidence_items(
    team_id,evaluation_context_id,visibility,source_type,title,observation,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_context,'private',
    'manual_observation','Private coach note','Only its author can read this.',auth.uid()
  );

  INSERT INTO public.evolution_evidence_items(
    team_id,evaluation_context_id,visibility,source_type,title,observation,created_by
  ) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_context,'coaches',
    'manual_observation','Coach review note','Visible to active coaches only.',auth.uid()
  );

  BEGIN
    INSERT INTO public.evolution_evidence_items(
      team_id,evaluation_context_id,visibility,status,source_type,title,observation,created_by
    ) VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_context,'team','verified',
      'manual_observation','Forged verified state','Clients cannot self-verify evidence.',auth.uid()
    );
    RAISE EXCEPTION 'client unexpectedly inserted verified evidence';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  IF (SELECT count(*) FROM public.evolution_evidence_items WHERE status='pending') <> 3 THEN
    RAISE EXCEPTION 'new evidence items must start pending';
  END IF;
END $$;

-- Player in Alpha can read team-visible evidence, but not coach/private notes.
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
DO $$
DECLARE team_count integer; private_count integer; coach_count integer;
BEGIN
  SELECT count(*) INTO team_count FROM public.evolution_evidence_items WHERE visibility='team';
  SELECT count(*) INTO private_count FROM public.evolution_evidence_items WHERE visibility='private';
  SELECT count(*) INTO coach_count FROM public.evolution_evidence_items WHERE visibility='coaches';
  IF team_count <> 1 OR private_count <> 0 OR coach_count <> 0 THEN
    RAISE EXCEPTION 'player visibility mismatch: team %, private %, coaches %',
      team_count,private_count,coach_count;
  END IF;
END $$;

-- Unrelated team cannot read Alpha evidence or contexts.
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
DO $$
DECLARE evidence_count integer; context_count integer; version_count integer;
BEGIN
  SELECT count(*) INTO evidence_count FROM public.evolution_evidence_items;
  SELECT count(*) INTO context_count FROM public.evolution_evaluation_contexts;
  SELECT count(*) INTO version_count FROM public.evolution_evidence_versions;
  IF evidence_count <> 0 OR context_count <> 0 OR version_count <> 0 THEN
    RAISE EXCEPTION 'cross-team evidence/context/history leaked';
  END IF;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.evolution_evidence_items','UPDATE')
    OR has_table_privilege('authenticated','public.evolution_evidence_items','DELETE')
    OR has_table_privilege('authenticated','public.evolution_evidence_versions','UPDATE')
    OR has_table_privilege('authenticated','public.evolution_evidence_versions','DELETE')
    OR has_table_privilege('authenticated','public.evolution_evidence_dimension_links','UPDATE')
    OR has_table_privilege('authenticated','public.evolution_evidence_dimension_links','DELETE')
  THEN RAISE EXCEPTION 'authenticated role has forbidden evidence mutation privileges'; END IF;
  IF has_table_privilege('anon','public.evolution_evidence_items','SELECT')
    OR has_table_privilege('anon','public.evolution_evidence_versions','SELECT')
  THEN RAISE EXCEPTION 'anonymous role can read evidence'; END IF;
  IF has_function_privilege('authenticated','evolution_private.seed_evolution_evidence_version()','EXECUTE')
    OR has_function_privilege('authenticated','evolution_private.guard_evolution_evidence_version()','EXECUTE')
  THEN RAISE EXCEPTION 'authenticated role can directly execute private evidence triggers'; END IF;
END $$;

SELECT 'Evolution Phase 3.3 evidence data model PostgreSQL PASS' AS result;
SQL
