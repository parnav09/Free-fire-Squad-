#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to a disposable CI PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Exercise the complete verified parent chain before adding Point 2.8.
DATABASE_URL="$DATABASE_URL" bash "$ROOT/scripts/verify-evolution-phase-two-7-db.sh"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261120220000_evolution_phase_two_8_result_verification.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- The competitive fixture uses only explicitly supplied source values.
INSERT INTO public.scrim_records(id,team_id,owner_id,scrim_date,match_count,matches)
VALUES (
  'aa200000-0000-0000-0000-000000000020',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '10000000-0000-0000-0000-000000000001',
  DATE '2026-11-22',2,
  '[{"placement":1,"kills":5},{"placement":3,"kills":2}]'::jsonb
);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session public.canonical_sessions;
  v_match1 uuid;
  v_match2 uuid;
  v_result1 public.canonical_session_results;
  v_result2 public.canonical_session_results;
  v_count integer;
  v_version integer;
BEGIN
  v_session:=public.create_canonical_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','scrim','Result Verification Test',
    '90000000-0000-0000-8000-000000000301',DATE '2026-11-22',NULL,NULL
  );
  INSERT INTO public.canonical_session_sources(team_id,canonical_session_id,source_system,scrim_record_id,created_by)
  VALUES(v_session.team_id,v_session.id,'scrim',
    'aa200000-0000-0000-0000-000000000020',auth.uid());
  IF public.sync_canonical_session_matches(v_session.id)<>2 THEN
    RAISE EXCEPTION 'Result fixture did not produce exactly two canonical matches';
  END IF;
  SELECT id INTO v_match1 FROM public.canonical_session_matches
    WHERE canonical_session_id=v_session.id ORDER BY match_sequence LIMIT 1;
  SELECT id INTO v_match2 FROM public.canonical_session_matches
    WHERE canonical_session_id=v_session.id ORDER BY match_sequence DESC LIMIT 1;

  PERFORM public.transition_canonical_session(v_session.id,0,'scheduled','Schedule result test',
    '90000000-0000-0000-8000-000000000302',NULL);
  PERFORM public.transition_canonical_session(v_session.id,1,'in_progress','Start result test',
    '90000000-0000-0000-8000-000000000303',NULL);

  v_result2:=public.save_canonical_session_result_draft(
    v_session.id,v_match2,'official_scorecard','scorecard://match-2',
    '{"placement":3,"kills":2}'::jsonb,'90000000-0000-0000-8000-000000000304'
  );
  IF v_result2.status<>'draft' OR v_result2.current_version_no<>1 THEN
    RAISE EXCEPTION 'Draft result state/version was not persisted';
  END IF;
  SELECT count(*) INTO v_count FROM public.canonical_verified_competitive_match_results
    WHERE canonical_session_id=v_session.id;
  IF v_count<>0 THEN RAISE EXCEPTION 'Draft result leaked into verified competitive aggregate'; END IF;

  PERFORM public.transition_canonical_session(v_session.id,2,'awaiting_results','Finish result test',
    '90000000-0000-0000-8000-000000000305',NULL);
  v_result1:=public.submit_canonical_session_result(
    v_session.id,v_match1,'official_scorecard','scorecard://match-1',
    '{"placement":1,"kills":5}'::jsonb,'90000000-0000-0000-8000-000000000306',NULL
  );
  v_result2:=public.submit_canonical_session_result(
    v_session.id,v_match2,'official_scorecard','scorecard://match-2',
    '{"placement":3,"kills":2}'::jsonb,'90000000-0000-0000-8000-000000000307',NULL
  );
  IF v_result2.current_version_no<>2 OR v_result2.status<>'submitted' THEN
    RAISE EXCEPTION 'Draft-to-submitted transition was not preserved';
  END IF;
  SELECT count(*) INTO v_count FROM public.canonical_session_result_submissions
    WHERE canonical_session_id=v_session.id;
  IF v_count<>1 THEN RAISE EXCEPTION 'Session result submission receipt was not reused'; END IF;

  BEGIN
    PERFORM public.transition_canonical_session(v_session.id,3,'verified','Premature verify',
      '90000000-0000-0000-8000-000000000308',NULL);
    RAISE EXCEPTION 'Session verified while match results were still unverified';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  BEGIN
    PERFORM public.verify_canonical_session_result(v_result1.id,
      '{"placement":1,"kills":5}'::jsonb,
      '{"source_identity_confirmed":true,"match_identity_confirmed":true,"values_reviewed":true,"no_inferred_values":false}'::jsonb,
      'Checklist intentionally incomplete','90000000-0000-0000-8000-000000000309');
    RAISE EXCEPTION 'Incomplete verification checklist was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  v_result1:=public.verify_canonical_session_result(v_result1.id,
    '{"placement":1,"kills":5}'::jsonb,
    '{"source_identity_confirmed":true,"match_identity_confirmed":true,"values_reviewed":true,"no_inferred_values":true}'::jsonb,
    'Checked against submitted scorecard','90000000-0000-0000-8000-000000000310');
  v_result2:=public.verify_canonical_session_result(v_result2.id,
    '{"placement":3,"kills":2}'::jsonb,
    '{"source_identity_confirmed":true,"match_identity_confirmed":true,"values_reviewed":true,"no_inferred_values":true}'::jsonb,
    'Checked against submitted scorecard','90000000-0000-0000-8000-000000000311');
  IF v_result1.status<>'verified' OR v_result2.status<>'verified' THEN
    RAISE EXCEPTION 'Verified result states were not recorded';
  END IF;
  PERFORM public.transition_canonical_session(v_session.id,3,'verified','Verify complete results',
    '90000000-0000-0000-8000-000000000312',NULL);
  SELECT count(*) INTO v_count FROM public.canonical_verified_competitive_match_results
    WHERE canonical_session_id=v_session.id;
  IF v_count<>2 THEN RAISE EXCEPTION 'Only verified competitive results should enter aggregate view'; END IF;

  -- A correction creates a new immutable version. The previous verified value
  -- remains in history, but the pending correction temporarily leaves aggregates.
  PERFORM public.reopen_canonical_session(v_session.id,4,'awaiting_results',
    'Correct source scorecard after verification','90000000-0000-0000-8000-000000000313');
  v_result1:=public.submit_canonical_session_result(
    v_session.id,v_match1,'official_scorecard','scorecard://match-1-revised',
    '{"placement":2,"kills":5}'::jsonb,'90000000-0000-0000-8000-000000000314',
    'Official scorecard revision supersedes prior placement'
  );
  IF v_result1.status<>'submitted' OR v_result1.current_version_no<>2 THEN
    RAISE EXCEPTION 'Correction was not stored as a new pending version';
  END IF;
  SELECT count(*) INTO v_count FROM public.canonical_verified_competitive_match_results
    WHERE canonical_session_id=v_session.id;
  IF v_count<>1 THEN RAISE EXCEPTION 'Pending correction did not suspend only its own aggregate row'; END IF;
  v_result1:=public.verify_canonical_session_result(v_result1.id,
    '{"placement":2,"kills":5}'::jsonb,
    '{"source_identity_confirmed":true,"match_identity_confirmed":true,"values_reviewed":true,"no_inferred_values":true}'::jsonb,
    'Rechecked revised scorecard','90000000-0000-0000-8000-000000000315');
  IF v_result1.status<>'amended' THEN RAISE EXCEPTION 'Verified correction did not enter amended state'; END IF;
  SELECT count(*) INTO v_count FROM public.canonical_verified_competitive_match_results
    WHERE canonical_session_id=v_session.id;
  IF v_count<>2 THEN RAISE EXCEPTION 'Amended result was not restored to verified aggregate eligibility'; END IF;
  SELECT count(*) INTO v_count FROM public.canonical_session_result_versions
    WHERE result_id=v_result1.id AND version_no IN (1,2);
  IF v_count<>2 THEN RAISE EXCEPTION 'Prior and corrected raw versions were not both preserved'; END IF;
  SELECT count(*) INTO v_count FROM public.canonical_session_result_events
    WHERE result_id=v_result1.id AND event_kind IN ('submitted','verified');
  IF v_count<>3 THEN RAISE EXCEPTION 'Correction event history is incomplete'; END IF;
END $$;
RESET ROLE;

-- Training has session-level evidence rather than a fabricated competitive match.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  v_session public.canonical_sessions;
  v_result public.canonical_session_results;
  v_count integer;
BEGIN
  v_session:=public.create_canonical_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','training','Training Result Verification Test',
    '90000000-0000-0000-8000-000000000321',DATE '2026-11-22',NULL,NULL
  );
  PERFORM public.transition_canonical_session(v_session.id,0,'scheduled','Schedule training result',
    '90000000-0000-0000-8000-000000000322',NULL);
  PERFORM public.transition_canonical_session(v_session.id,1,'in_progress','Start training result',
    '90000000-0000-0000-8000-000000000323',NULL);
  v_result:=public.save_canonical_session_result_draft(
    v_session.id,NULL,'training_log','training://session-1',
    '{"drill":"rotation review","completed":true}'::jsonb,'90000000-0000-0000-8000-000000000324'
  );
  PERFORM public.transition_canonical_session(v_session.id,2,'awaiting_results','Finish training result',
    '90000000-0000-0000-8000-000000000325',NULL);
  v_result:=public.submit_canonical_session_result(
    v_session.id,NULL,'training_log','training://session-1',
    '{"drill":"rotation review","completed":true}'::jsonb,'90000000-0000-0000-8000-000000000326',NULL
  );
  v_result:=public.verify_canonical_session_result(v_result.id,
    '{"drill":"rotation review","completed":true}'::jsonb,
    '{"source_identity_confirmed":true,"activity_confirmed":true,"participants_confirmed":true,"no_inferred_values":true}'::jsonb,
    'Checked against training log','90000000-0000-0000-8000-000000000327');
  IF v_result.status<>'verified' THEN RAISE EXCEPTION 'Training result did not reach verified state'; END IF;
  SELECT count(*) INTO v_count FROM public.canonical_verified_training_results
    WHERE canonical_session_id=v_session.id;
  IF v_count<>1 THEN RAISE EXCEPTION 'Verified training result missing from training view'; END IF;
  SELECT count(*) INTO v_count FROM public.canonical_verified_competitive_match_results
    WHERE canonical_session_id=v_session.id;
  IF v_count<>0 THEN RAISE EXCEPTION 'Training evidence leaked into competitive aggregates'; END IF;
END $$;
RESET ROLE;

-- Player and cross-team reads/writes fail closed; history is immutable.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
DO $$
DECLARE v_result uuid; v_session uuid; v_count integer;
BEGIN
  SELECT r.id,r.canonical_session_id INTO v_result,v_session
  FROM public.canonical_session_results r
  JOIN public.canonical_sessions s ON s.id=r.canonical_session_id
  WHERE s.title='Result Verification Test' LIMIT 1;
  SELECT count(*) INTO v_count FROM public.canonical_session_results WHERE id=v_result;
  IF v_count<>0 THEN RAISE EXCEPTION 'Player can read staff-only result audit'; END IF;
  BEGIN
    PERFORM public.submit_canonical_session_result(v_session,
      (SELECT id FROM public.canonical_session_matches WHERE canonical_session_id=v_session LIMIT 1),
      'official_scorecard','player-attempt','{"kills":999}'::jsonb,
      '90000000-0000-0000-8000-000000000328',NULL);
    RAISE EXCEPTION 'Player was allowed to submit a trusted result';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.canonical_session_results;
  IF v_count<>0 THEN RAISE EXCEPTION 'Cross-team result visibility leaked'; END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.canonical_session_results','INSERT')
    OR has_table_privilege('authenticated','public.canonical_session_results','UPDATE')
    OR has_table_privilege('authenticated','public.canonical_session_results','DELETE')
    OR has_table_privilege('authenticated','public.canonical_session_result_versions','INSERT')
    OR has_table_privilege('authenticated','public.canonical_session_result_versions','UPDATE')
    OR has_table_privilege('authenticated','public.canonical_session_result_versions','DELETE')
    OR has_table_privilege('authenticated','public.canonical_session_result_events','INSERT')
    OR has_table_privilege('authenticated','public.canonical_session_result_events','UPDATE')
    OR has_table_privilege('authenticated','public.canonical_session_result_events','DELETE')
  THEN RAISE EXCEPTION 'Authenticated role can directly mutate result records'; END IF;
  IF has_function_privilege('authenticated','evolution_private.guard_canonical_session_result_root()','EXECUTE')
    OR has_function_privilege('authenticated','evolution_private.guard_canonical_session_result_append()','EXECUTE')
  THEN RAISE EXCEPTION 'API role can execute private result trigger function'; END IF;
END $$;

SELECT 'Evolution Phase Two.8 PostgreSQL integration PASS' AS result;
SQL
