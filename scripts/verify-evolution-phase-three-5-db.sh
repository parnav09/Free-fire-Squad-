#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122160000_evolution_phase_three_5_versioned_rubric_engine.sql"

# Rebuild only disposable Phase 2.2–2.6 and Phase 3.2–3.4 fixtures.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-three-4-db.sh"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000007',false);

DO $$
DECLARE
  v_team uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_context uuid;
  v_rubric uuid;
  v_version_one uuid;
  v_version_two uuid;
  v_version_three uuid;
  v_incomplete_rubric uuid;
  v_incomplete_version uuid;
  v_dimension record;
  v_anchors jsonb;
  v_roles jsonb;
  v_count integer;
  v_status text;
  v_bound_version uuid;
  v_new_context uuid;
BEGIN
  SELECT evaluation_context_id INTO v_context
  FROM public.evolution_evidence_items
  WHERE title='Rotation timing' AND visibility='team'
  ORDER BY created_at LIMIT 1;
  IF v_context IS NULL THEN RAISE EXCEPTION 'Phase 3.3 evaluation context fixture missing'; END IF;

  INSERT INTO public.evolution_rubrics(team_id,rubric_key,created_by)
  VALUES (v_team,'competitive_core',auth.uid())
  RETURNING id INTO v_rubric;

  INSERT INTO public.evolution_rubric_versions(
    rubric_id,team_id,version_number,title,description,effective_from,created_by
  ) VALUES (
    v_rubric,v_team,1,'Competitive Core','Version one rubric fixture',
    clock_timestamp() - interval '1 day',auth.uid()
  ) RETURNING id INTO v_version_one;

  FOR v_dimension IN
    SELECT d.dimension_key, d.definition_version, d.applicable_role_keys
    FROM public.evolution_dimension_definition_versions d
    JOIN public.evolution_dimension_registry r USING (dimension_key)
    WHERE r.lifecycle_status='active'
    ORDER BY r.sort_order
  LOOP
    SELECT jsonb_object_agg(level::text,
      to_jsonb(v_dimension.dimension_key || ' rating ' || level::text || ' anchor'))
    INTO v_anchors
    FROM generate_series(0,10) AS levels(level);
    v_roles := CASE WHEN v_dimension.dimension_key='role_execution'
      THEN jsonb_build_object(
        'primary_rusher','Role execution guidance for primary entry responsibility',
        'secondary_rusher','Role execution guidance for coordinated follow-up',
        'third_rusher_flanker','Role execution guidance for flank and support',
        'sniper_igl','Role execution guidance for information and leadership'
      )
      ELSE '{}'::jsonb END;
    INSERT INTO public.evolution_rubric_dimension_criteria(
      rubric_version_id,team_id,dimension_key,dimension_definition_version,
      criteria_guidance,rating_anchors,role_guidance,sort_order,created_by
    ) VALUES (
      v_version_one,v_team,v_dimension.dimension_key,v_dimension.definition_version,
      'Evaluate ' || v_dimension.dimension_key || ' using observed match context.',
      v_anchors,v_roles,
      (SELECT sort_order FROM public.evolution_dimension_registry WHERE dimension_key=v_dimension.dimension_key),
      auth.uid()
    );
  END LOOP;

  SELECT count(*) INTO v_count
  FROM public.evolution_rubric_dimension_criteria
  WHERE rubric_version_id=v_version_one;
  IF v_count <> 6 THEN RAISE EXCEPTION 'Expected six canonical rubric criteria, got %',v_count; END IF;

  UPDATE public.evolution_rubric_versions
  SET lifecycle_status='active'
  WHERE id=v_version_one;
  SELECT lifecycle_status INTO v_status
  FROM public.evolution_rubric_versions WHERE id=v_version_one;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'Complete rubric did not publish'; END IF;

  INSERT INTO public.evolution_evaluation_rubric_bindings(
    team_id,evaluation_context_id,rubric_version_id,bound_by
  ) VALUES (v_team,v_context,v_version_one,auth.uid());

  SELECT rubric_version_id INTO v_bound_version
  FROM public.evolution_evaluation_rubric_bindings
  WHERE evaluation_context_id=v_context;
  IF v_bound_version <> v_version_one THEN RAISE EXCEPTION 'Evaluation context did not retain exact rubric version'; END IF;

  BEGIN
    UPDATE public.evolution_rubric_versions SET title='Mutated published title'
    WHERE id=v_version_one;
    RAISE EXCEPTION 'Published rubric title mutation unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;

  BEGIN
    UPDATE public.evolution_rubric_dimension_criteria
    SET criteria_guidance='Mutated published criterion'
    WHERE rubric_version_id=v_version_one AND dimension_key='communication';
    RAISE EXCEPTION 'Published rubric criteria mutation unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;

  INSERT INTO public.evolution_rubric_versions(
    rubric_id,team_id,version_number,title,description,effective_from,created_by
  ) VALUES (
    v_rubric,v_team,2,'Competitive Core','Version two rubric fixture',
    clock_timestamp() - interval '1 minute',auth.uid()
  ) RETURNING id INTO v_version_two;

  INSERT INTO public.evolution_rubric_dimension_criteria(
    rubric_version_id,team_id,dimension_key,dimension_definition_version,
    criteria_guidance,rating_anchors,sort_order,created_by
  )
  SELECT v_version_two,v_team,d.dimension_key,d.definition_version,
    'Version two guidance for ' || d.dimension_key,
    (SELECT jsonb_object_agg(level::text,to_jsonb(d.dimension_key || ' v2 rating ' || level::text))
      FROM generate_series(0,10) AS levels(level)),
    r.sort_order,auth.uid()
  FROM public.evolution_dimension_definition_versions d
  JOIN public.evolution_dimension_registry r USING (dimension_key)
  WHERE r.lifecycle_status='active';

  BEGIN
    UPDATE public.evolution_rubric_versions SET lifecycle_status='active'
    WHERE id=v_version_two;
    RAISE EXCEPTION 'Two active versions for one rubric unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  UPDATE public.evolution_rubric_versions SET lifecycle_status='retired'
  WHERE id=v_version_one;
  UPDATE public.evolution_rubric_versions SET lifecycle_status='active'
  WHERE id=v_version_two;

  SELECT lifecycle_status INTO v_status
  FROM public.evolution_rubric_versions WHERE id=v_version_one;
  IF v_status <> 'retired' THEN RAISE EXCEPTION 'Version one was not retired'; END IF;

  BEGIN
    UPDATE public.evolution_rubric_versions SET title='Mutate retired version'
    WHERE id=v_version_one;
    RAISE EXCEPTION 'Retired rubric mutation unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;

  -- An incomplete rubric cannot be published.
  INSERT INTO public.evolution_rubrics(team_id,rubric_key,created_by)
  VALUES (v_team,'incomplete_rubric',auth.uid())
  RETURNING id INTO v_incomplete_rubric;
  INSERT INTO public.evolution_rubric_versions(
    rubric_id,team_id,version_number,title,description,effective_from,created_by
  ) VALUES (
    v_incomplete_rubric,v_team,1,'Incomplete','Missing five dimension definitions',
    clock_timestamp() - interval '1 day',auth.uid()
  ) RETURNING id INTO v_incomplete_version;
  INSERT INTO public.evolution_rubric_dimension_criteria(
    rubric_version_id,team_id,dimension_key,dimension_definition_version,
    criteria_guidance,rating_anchors,sort_order,created_by
  ) VALUES (
    v_incomplete_version,v_team,'communication',1,'Only one dimension',
    (SELECT jsonb_object_agg(level::text,to_jsonb('Communication level ' || level::text))
      FROM generate_series(0,10) AS levels(level)),1,auth.uid()
  );
  BEGIN
    UPDATE public.evolution_rubric_versions SET lifecycle_status='active'
    WHERE id=v_incomplete_version;
    RAISE EXCEPTION 'Incomplete rubric unexpectedly published';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Invalid role-specific guidance is rejected by the database.
  INSERT INTO public.evolution_rubric_versions(
    rubric_id,team_id,version_number,title,description,effective_from,created_by
  ) VALUES (
    v_incomplete_rubric,v_team,2,'Invalid Role','Invalid role guidance test',
    clock_timestamp() - interval '1 day',auth.uid()
  ) RETURNING id INTO v_version_three;
  BEGIN
    INSERT INTO public.evolution_rubric_dimension_criteria(
      rubric_version_id,team_id,dimension_key,dimension_definition_version,
      criteria_guidance,rating_anchors,role_guidance,sort_order,created_by
    ) VALUES (
      v_version_three,v_team,'communication',1,'Role applicability test',
      (SELECT jsonb_object_agg(level::text,to_jsonb('Communication level ' || level::text))
        FROM generate_series(0,10) AS levels(level)),
      jsonb_build_object('not_a_role','This role is invalid'),1,auth.uid()
    );
    RAISE EXCEPTION 'Invalid role-specific guidance unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Invalid anchor sets are rejected even for a draft.
  BEGIN
    INSERT INTO public.evolution_rubric_dimension_criteria(
      rubric_version_id,team_id,dimension_key,dimension_definition_version,
      criteria_guidance,rating_anchors,sort_order,created_by
    ) VALUES (
      v_version_three,v_team,'communication',1,'Anchor completeness test',
      '{"0":"zero","1":"one"}'::jsonb,1,auth.uid()
    );
    RAISE EXCEPTION 'Incomplete rating anchors unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A second binding for one evaluation context is not allowed.
  BEGIN
    INSERT INTO public.evolution_evaluation_rubric_bindings(
      team_id,evaluation_context_id,rubric_version_id,bound_by
    ) VALUES (v_team,v_context,v_version_two,auth.uid());
    RAISE EXCEPTION 'Duplicate evaluation rubric binding unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Create a later evaluation context and bind the newly active version.
  INSERT INTO public.evolution_evaluation_contexts(
    team_id,player_member_id,player_user_id,canonical_session_id,
    canonical_session_match_id,role_assignment_id,created_by
  )
  SELECT team_id,player_member_id,player_user_id,canonical_session_id,
    canonical_session_match_id,role_assignment_id,auth.uid()
  FROM public.evolution_evaluation_contexts
  WHERE id=v_context
  RETURNING id INTO v_new_context;
  INSERT INTO public.evolution_evaluation_rubric_bindings(
    team_id,evaluation_context_id,rubric_version_id,bound_by
  ) VALUES (v_team,v_new_context,v_version_two,auth.uid());

  BEGIN
    UPDATE public.evolution_evaluation_rubric_bindings
    SET rubric_version_id=v_version_one
    WHERE evaluation_context_id=v_context;
    RAISE EXCEPTION 'Evaluation rubric binding mutation unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- A draft is visible to a coach but not to an ordinary team member.
  INSERT INTO public.evolution_rubric_versions(
    rubric_id,team_id,version_number,title,description,created_by
  ) VALUES (
    v_rubric,v_team,3,'Competitive Core','Draft visible to coaches only',auth.uid()
  );
END $$;

RESET ROLE;

-- Ordinary active players can read active rubric versions, not drafts.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000008',false);
DO $$
DECLARE visible_active integer; visible_draft integer; visible_criteria integer;
BEGIN
  SELECT count(*) INTO visible_active
  FROM public.evolution_rubric_versions WHERE lifecycle_status='active';
  SELECT count(*) INTO visible_draft
  FROM public.evolution_rubric_versions WHERE lifecycle_status='draft';
  SELECT count(*) INTO visible_criteria
  FROM public.evolution_rubric_dimension_criteria;
  IF visible_active <> 1 OR visible_draft <> 0 OR visible_criteria <> 6 THEN
    RAISE EXCEPTION 'Player rubric visibility mismatch: active %, draft %, criteria %',
      visible_active,visible_draft,visible_criteria;
  END IF;

  BEGIN
    INSERT INTO public.evolution_rubrics(team_id,rubric_key,created_by)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','player_forbidden',auth.uid());
    RAISE EXCEPTION 'Player unexpectedly created a rubric';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.evolution_rubrics','UPDATE')
    OR has_table_privilege('authenticated','public.evolution_rubrics','DELETE')
    OR has_table_privilege('authenticated','public.evolution_rubric_versions','DELETE')
    OR has_table_privilege('authenticated','public.evolution_evaluation_rubric_bindings','UPDATE')
    OR has_table_privilege('authenticated','public.evolution_evaluation_rubric_bindings','DELETE')
  THEN RAISE EXCEPTION 'Authenticated role has forbidden rubric mutation privileges'; END IF;
  IF has_table_privilege('anon','public.evolution_rubrics','SELECT')
    OR has_table_privilege('anon','public.evolution_rubric_versions','SELECT')
    OR has_table_privilege('anon','public.evolution_rubric_dimension_criteria','SELECT')
    OR has_table_privilege('anon','public.evolution_evaluation_rubric_bindings','SELECT')
  THEN RAISE EXCEPTION 'Anonymous role can read rubric data'; END IF;
END $$;

SELECT 'Evolution Phase 3.5 versioned rubric engine PostgreSQL PASS' AS result;
SQL
