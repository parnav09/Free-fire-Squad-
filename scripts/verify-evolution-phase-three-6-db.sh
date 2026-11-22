#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122170000_evolution_phase_three_6_role_weight_configuration.sql"

# Rebuild the complete verified Phase 2.6 role-snapshot + Phase 3.2–3.5 chain.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-three-5-db.sh"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000007',false);

DO $$
DECLARE
  v_team uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_rubric_version uuid;
  v_context uuid;
  v_next_context uuid;
  v_no_role_context uuid;
  v_role_assignment uuid;
  v_role_key text;
  v_player_member uuid;
  v_player_user uuid;
  v_session uuid;
  v_match uuid;
  v_set_one uuid;
  v_set_two uuid;
  v_set_three uuid;
  v_bad_count integer;
  v_weight_count integer;
  v_total integer;
  v_first_dimension text;
BEGIN
  SELECT id INTO v_rubric_version
  FROM public.evolution_rubric_versions
  WHERE team_id=v_team AND title='Competitive Core' AND lifecycle_status='active'
  ORDER BY version_number LIMIT 1;
  IF v_rubric_version IS NULL THEN
    RAISE EXCEPTION 'Phase 3.5 active rubric fixture missing';
  END IF;

  SELECT r.id,r.player_user_id,r.canonical_session_id,r.canonical_session_match_id,
         CASE lower(btrim(r.role_key_snapshot))
           WHEN 'primary rusher' THEN 'primary_rusher'
           WHEN 'primary-rusher' THEN 'primary_rusher'
           WHEN 'secondary rusher' THEN 'secondary_rusher'
           WHEN 'secondary-rusher' THEN 'secondary_rusher'
           WHEN 'third rusher flanker' THEN 'third_rusher_flanker'
           WHEN 'third-rusher-flanker' THEN 'third_rusher_flanker'
           WHEN 'sniper + igl' THEN 'sniper_igl'
           WHEN 'sniper igl' THEN 'sniper_igl'
           WHEN 'sniper-igl' THEN 'sniper_igl'
           WHEN 'substitute flex' THEN 'substitute_flex'
           WHEN 'substitute-flex' THEN 'substitute_flex'
           WHEN 'other' THEN 'other'
           ELSE NULL END,
         tm.id
    INTO v_role_assignment,v_player_user,v_session,v_match,v_role_key,v_player_member
  FROM public.canonical_session_match_roles r
  JOIN public.team_members tm
    ON tm.team_id=r.team_id AND tm.user_id=r.player_user_id AND tm.status='active'
  WHERE r.team_id=v_team
    AND r.role_assignment_status IN ('assigned','retired')
    AND lower(btrim(r.role_key_snapshot)) IN (
      'primary rusher','primary-rusher','secondary rusher','secondary-rusher',
      'third rusher flanker','third-rusher-flanker','sniper + igl','sniper igl','sniper-igl',
      'substitute flex','substitute-flex','other'
    )
  ORDER BY r.changed_at,r.id LIMIT 1;
  IF v_role_assignment IS NULL THEN
    RAISE EXCEPTION 'Phase 2.6 canonical match role snapshot fixture missing';
  END IF;

  INSERT INTO public.evolution_role_weight_sets(
    team_id,rubric_version_id,role_key,version_number,created_by
  ) VALUES (v_team,v_rubric_version,v_role_key,1,auth.uid())
  RETURNING id INTO v_set_one;

  WITH applicable AS (
    SELECT rc.dimension_key,rc.dimension_definition_version,
      row_number() OVER (ORDER BY rc.sort_order) AS rn,
      count(*) OVER () AS n
    FROM public.evolution_rubric_dimension_criteria rc
    JOIN public.evolution_dimension_definition_versions dd
      ON dd.dimension_key=rc.dimension_key
     AND dd.definition_version=rc.dimension_definition_version
    JOIN public.evolution_dimension_registry dr USING (dimension_key)
    WHERE rc.rubric_version_id=v_rubric_version
      AND dr.lifecycle_status='active'
      AND v_role_key=ANY(dd.applicable_role_keys)
  )
  INSERT INTO public.evolution_role_dimension_weights(
    weight_set_id,team_id,dimension_key,dimension_definition_version,weight_basis_points,created_by
  )
  SELECT v_set_one,v_team,dimension_key,dimension_definition_version,
    (10000 / n) + CASE WHEN rn <= (10000 % n) THEN 1 ELSE 0 END,
    auth.uid()
  FROM applicable;

  UPDATE public.evolution_role_weight_sets
  SET lifecycle_status='active',
      effective_from=clock_timestamp(),
      published_by=auth.uid()
  WHERE id=v_set_one;

  -- The weight set must exist and become effective before the evaluation context is created.
  INSERT INTO public.evolution_evaluation_contexts(
    team_id,player_member_id,player_user_id,canonical_session_id,
    canonical_session_match_id,role_assignment_id,created_by
  ) VALUES (
    v_team,v_player_member,v_player_user,v_session,v_match,v_role_assignment,auth.uid()
  ) RETURNING id INTO v_context;
  INSERT INTO public.evolution_evaluation_rubric_bindings(
    team_id,evaluation_context_id,rubric_version_id,bound_by
  ) VALUES (v_team,v_context,v_rubric_version,auth.uid());

  INSERT INTO public.evolution_evaluation_role_weight_bindings(
    team_id,evaluation_context_id,role_assignment_id,weight_set_id,role_key,bound_by
  ) VALUES (v_team,v_context,v_role_assignment,v_set_one,v_role_key,auth.uid());

  IF NOT EXISTS (
    SELECT 1 FROM public.evolution_evaluation_role_weight_bindings
    WHERE evaluation_context_id=v_context AND role_assignment_id=v_role_assignment
      AND weight_set_id=v_set_one AND role_key=v_role_key
  ) THEN
    RAISE EXCEPTION 'Exact historical role-weight binding was not persisted';
  END IF;

  SELECT dimension_key INTO v_first_dimension
  FROM public.evolution_role_dimension_weights
  WHERE weight_set_id=v_set_one ORDER BY dimension_key LIMIT 1;

  INSERT INTO public.evolution_role_weight_sets(
    team_id,rubric_version_id,role_key,version_number,created_by
  ) VALUES (v_team,v_rubric_version,v_role_key,2,auth.uid())
  RETURNING id INTO v_set_two;

  INSERT INTO public.evolution_role_dimension_weights(
    weight_set_id,team_id,dimension_key,dimension_definition_version,weight_basis_points,created_by
  )
  SELECT v_set_two,v_team,dimension_key,dimension_definition_version,weight_basis_points,auth.uid()
  FROM public.evolution_role_dimension_weights WHERE weight_set_id=v_set_one;

  UPDATE public.evolution_role_dimension_weights
  SET weight_basis_points=weight_basis_points+1
  WHERE weight_set_id=v_set_two AND dimension_key=v_first_dimension;
  BEGIN
    UPDATE public.evolution_role_weight_sets
    SET lifecycle_status='active',
        effective_from=clock_timestamp(),
        published_by=auth.uid()
    WHERE id=v_set_two;
    RAISE EXCEPTION 'Invalid 10001-basis-point configuration unexpectedly activated';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  UPDATE public.evolution_role_dimension_weights
  SET weight_basis_points=weight_basis_points-1
  WHERE weight_set_id=v_set_two AND dimension_key=v_first_dimension;

  BEGIN
    INSERT INTO public.evolution_role_dimension_weights(
      weight_set_id,team_id,dimension_key,dimension_definition_version,weight_basis_points,created_by
    )
    SELECT weight_set_id,team_id,dimension_key,dimension_definition_version,weight_basis_points,auth.uid()
    FROM public.evolution_role_dimension_weights
    WHERE weight_set_id=v_set_two ORDER BY dimension_key LIMIT 1;
    RAISE EXCEPTION 'Duplicate dimension weight unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  UPDATE public.evolution_role_weight_sets
  SET lifecycle_status='retired'
  WHERE id=v_set_one;

  UPDATE public.evolution_role_weight_sets
  SET lifecycle_status='active',
      effective_from=clock_timestamp(),
      published_by=auth.uid()
  WHERE id=v_set_two;

  INSERT INTO public.evolution_evaluation_contexts(
    team_id,player_member_id,player_user_id,canonical_session_id,
    canonical_session_match_id,role_assignment_id,created_by
  ) VALUES (v_team,v_player_member,v_player_user,v_session,v_match,v_role_assignment,auth.uid())
  RETURNING id INTO v_next_context;
  INSERT INTO public.evolution_evaluation_rubric_bindings(
    team_id,evaluation_context_id,rubric_version_id,bound_by
  ) VALUES (v_team,v_next_context,v_rubric_version,auth.uid());
  INSERT INTO public.evolution_evaluation_role_weight_bindings(
    team_id,evaluation_context_id,role_assignment_id,weight_set_id,role_key,bound_by
  ) VALUES (v_team,v_next_context,v_role_assignment,v_set_two,v_role_key,auth.uid());

  BEGIN
    UPDATE public.evolution_role_dimension_weights
    SET weight_basis_points=weight_basis_points
    WHERE weight_set_id=v_set_two;
    RAISE EXCEPTION 'Published dimension weights unexpectedly remained editable';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;

  BEGIN
    INSERT INTO public.evolution_evaluation_role_weight_bindings(
      team_id,evaluation_context_id,role_assignment_id,weight_set_id,role_key,bound_by
    ) VALUES (v_team,v_next_context,v_role_assignment,v_set_two,
      CASE WHEN v_role_key='primary_rusher' THEN 'secondary_rusher' ELSE 'primary_rusher' END,auth.uid());
    RAISE EXCEPTION 'Role mismatch binding unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A context without a role snapshot must not inherit the player's current team role.
  INSERT INTO public.evolution_evaluation_contexts(
    team_id,player_member_id,player_user_id,created_by
  )
  SELECT team_id,player_member_id,player_user_id,auth.uid()
  FROM public.evolution_evaluation_contexts WHERE id=v_context
  RETURNING id INTO v_no_role_context;
  INSERT INTO public.evolution_evaluation_rubric_bindings(
    team_id,evaluation_context_id,rubric_version_id,bound_by
  ) VALUES (v_team,v_no_role_context,v_rubric_version,auth.uid());
  BEGIN
    INSERT INTO public.evolution_evaluation_role_weight_bindings(
      team_id,evaluation_context_id,role_assignment_id,weight_set_id,role_key,bound_by
    ) VALUES (v_team,v_no_role_context,v_role_assignment,v_set_two,v_role_key,auth.uid());
    RAISE EXCEPTION 'Role-less evaluation unexpectedly received a role weight set';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.evolution_role_weight_sets(
    team_id,rubric_version_id,role_key,version_number,created_by
  ) VALUES (v_team,v_rubric_version,v_role_key,3,auth.uid())
  RETURNING id INTO v_set_three;

  SELECT count(*),coalesce(sum(weight_basis_points),0)
    INTO v_weight_count,v_total
  FROM public.evolution_role_dimension_weights WHERE weight_set_id=v_set_two;
  IF v_weight_count=0 OR v_total<>10000 THEN
    RAISE EXCEPTION 'Active weight set does not retain exact normalized integer weights';
  END IF;
END $$;

RESET ROLE;

-- Ordinary team players may read published sets, not drafts or draft weights.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000008',false);
DO $$
DECLARE v_active integer; v_retired integer; v_draft integer; v_draft_weights integer;
BEGIN
  SELECT count(*) INTO v_active FROM public.evolution_role_weight_sets WHERE lifecycle_status='active';
  SELECT count(*) INTO v_retired FROM public.evolution_role_weight_sets WHERE lifecycle_status='retired';
  SELECT count(*) INTO v_draft FROM public.evolution_role_weight_sets WHERE lifecycle_status='draft';
  SELECT count(*) INTO v_draft_weights
  FROM public.evolution_role_dimension_weights w
  JOIN public.evolution_role_weight_sets ws ON ws.id=w.weight_set_id
  WHERE ws.lifecycle_status='draft';
  IF v_active<>1 OR v_retired<>1 OR v_draft<>0 OR v_draft_weights<>0 THEN
    RAISE EXCEPTION 'Player role-weight visibility mismatch: active %, retired %, draft %, draft weights %',
      v_active,v_retired,v_draft,v_draft_weights;
  END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.evolution_role_weight_sets','DELETE')
    OR has_table_privilege('authenticated','public.evolution_role_dimension_weights','TRUNCATE')
    OR has_table_privilege('authenticated','public.evolution_evaluation_role_weight_bindings','UPDATE')
    OR has_table_privilege('authenticated','public.evolution_evaluation_role_weight_bindings','DELETE')
  THEN RAISE EXCEPTION 'Authenticated role has forbidden role-weight mutation privileges'; END IF;
  IF has_table_privilege('anon','public.evolution_role_weight_sets','SELECT')
    OR has_table_privilege('anon','public.evolution_role_dimension_weights','SELECT')
    OR has_table_privilege('anon','public.evolution_evaluation_role_weight_bindings','SELECT')
  THEN RAISE EXCEPTION 'Anonymous role can read role-weight configuration'; END IF;
END $$;

SELECT 'Evolution Phase 3.6 role-based weight configuration PostgreSQL PASS' AS result;
SQL
