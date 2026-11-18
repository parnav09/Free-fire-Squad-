-- Evolution Phase 1.5: performance-only remediation.
-- Adds indexes for the evolution-owned foreign keys and preserves existing
-- row-access semantics while removing redundant permissive policy overlap.
-- Excludes player_character_loadouts and does not alter auth/security advisor items.

-- Cover every evolution-scope foreign key reported by the performance advisor.
CREATE INDEX IF NOT EXISTS idx_daily_score_feedback_team_id_fk ON public.daily_score_feedback (team_id);
CREATE INDEX IF NOT EXISTS idx_practice_plan_blocks_team_id_fk ON public.practice_plan_blocks (team_id);
CREATE INDEX IF NOT EXISTS idx_practice_plans_created_by_fk ON public.practice_plans (created_by);
CREATE INDEX IF NOT EXISTS idx_practice_task_events_actor_id_fk ON public.practice_task_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_practice_task_events_team_id_fk ON public.practice_task_events (team_id);
CREATE INDEX IF NOT EXISTS idx_practice_tasks_assigned_by_fk ON public.practice_tasks (assigned_by);
CREATE INDEX IF NOT EXISTS idx_practice_tasks_block_id_fk ON public.practice_tasks (block_id);
CREATE INDEX IF NOT EXISTS idx_practice_tasks_completion_submitted_by_fk ON public.practice_tasks (completion_submitted_by);
CREATE INDEX IF NOT EXISTS idx_practice_tasks_plan_id_fk ON public.practice_tasks (plan_id);
CREATE INDEX IF NOT EXISTS idx_practice_tasks_source_session_id_fk ON public.practice_tasks (source_session_id);
CREATE INDEX IF NOT EXISTS idx_scrim_records_owner_id_fk ON public.scrim_records (owner_id);
CREATE INDEX IF NOT EXISTS idx_scrim_team_reviews_author_id_fk ON public.scrim_team_reviews (author_id);
CREATE INDEX IF NOT EXISTS idx_scrim_team_reviews_team_id_fk ON public.scrim_team_reviews (team_id);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_reviewed_by_fk ON public.team_join_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_user_id_fk ON public.team_join_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_training_drills_created_by_fk ON public.training_drills (created_by);
CREATE INDEX IF NOT EXISTS idx_training_results_player_member_id_fk ON public.training_results (player_member_id);
CREATE INDEX IF NOT EXISTS idx_training_results_submitted_by_fk ON public.training_results (submitted_by);
CREATE INDEX IF NOT EXISTS idx_training_results_team_id_fk ON public.training_results (team_id);
CREATE INDEX IF NOT EXISTS idx_training_session_participants_player_member_id_fk ON public.training_session_participants (player_member_id);
CREATE INDEX IF NOT EXISTS idx_training_session_participants_team_id_fk ON public.training_session_participants (team_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_created_by_fk ON public.training_sessions (created_by);
CREATE INDEX IF NOT EXISTS idx_training_sessions_drill_id_fk ON public.training_sessions (drill_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_plan_id_fk ON public.training_sessions (plan_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_team_id_fk ON public.training_sessions (team_id);

-- Split staff ALL policies into command-specific policies so SELECT access is
-- represented by the team-read policy rather than duplicated permissive rules.
DO $$
DECLARE
  v_table text;
  v_staff_expr text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['practice_plans', 'practice_plan_blocks'] LOOP
    v_staff_expr := format(
      'EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = %I.team_id AND tm.user_id = (select auth.uid()) AND tm.status = ''active'' AND tm.membership_role IN (''owner'', ''coach''))',
      v_table
    );

    EXECUTE format('DROP POLICY IF EXISTS squad_staff_write ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY squad_staff_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
      v_table, v_staff_expr
    );
    EXECUTE format(
      'CREATE POLICY squad_staff_update ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      v_table, v_staff_expr, v_staff_expr
    );
    EXECUTE format(
      'CREATE POLICY squad_staff_delete ON public.%I FOR DELETE TO authenticated USING (%s)',
      v_table, v_staff_expr
    );
  END LOOP;
END $$;

-- Consolidate all practice_tasks permissive policies into one policy per action.
DROP POLICY IF EXISTS practice_tasks_igl_manage ON public.practice_tasks;
DROP POLICY IF EXISTS practice_tasks_member_update ON public.practice_tasks;
DROP POLICY IF EXISTS squad_staff_write ON public.practice_tasks;
DROP POLICY IF EXISTS squad_team_read ON public.practice_tasks;

CREATE POLICY practice_tasks_select ON public.practice_tasks
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND COALESCE(tm.assigned_role, '') ILIKE '%igl%'
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
);

CREATE POLICY practice_tasks_insert ON public.practice_tasks
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND COALESCE(tm.assigned_role, '') ILIKE '%igl%'
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
);

CREATE POLICY practice_tasks_update ON public.practice_tasks
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND COALESCE(tm.assigned_role, '') ILIKE '%igl%'
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = practice_tasks.player_member_id
      AND tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND COALESCE(tm.assigned_role, '') ILIKE '%igl%'
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = practice_tasks.player_member_id
      AND tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
  )
);

CREATE POLICY practice_tasks_delete ON public.practice_tasks
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND COALESCE(tm.assigned_role, '') ILIKE '%igl%'
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = practice_tasks.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
);

-- Training drills: combine team-member and public-template reads; split staff writes.
DROP POLICY IF EXISTS squad_staff_write ON public.training_drills;
DROP POLICY IF EXISTS squad_team_read ON public.training_drills;
DROP POLICY IF EXISTS training_drills_template_read ON public.training_drills;

CREATE POLICY training_drills_read ON public.training_drills
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = training_drills.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
  )
  OR (training_drills.is_template = true AND training_drills.team_id IS NULL)
);

CREATE POLICY training_drills_staff_insert ON public.training_drills
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = training_drills.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
);

CREATE POLICY training_drills_staff_update ON public.training_drills
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = training_drills.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = training_drills.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
);

CREATE POLICY training_drills_staff_delete ON public.training_drills
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = training_drills.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'active'
      AND tm.membership_role IN ('owner', 'coach')
  )
);

-- The staff policy grants no additional SELECT access beyond active team members.
DO $$
DECLARE
  v_table text;
  v_staff_expr text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['training_results', 'training_session_participants', 'training_sessions'] LOOP
    v_staff_expr := format(
      'EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = %I.team_id AND tm.user_id = (select auth.uid()) AND tm.status = ''active'' AND tm.membership_role IN (''owner'', ''coach''))',
      v_table
    );

    EXECUTE format('DROP POLICY IF EXISTS squad_staff_write ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY squad_staff_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
      v_table, v_staff_expr
    );
    EXECUTE format(
      'CREATE POLICY squad_staff_update ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      v_table, v_staff_expr, v_staff_expr
    );
    EXECUTE format(
      'CREATE POLICY squad_staff_delete ON public.%I FOR DELETE TO authenticated USING (%s)',
      v_table, v_staff_expr
    );
  END LOOP;
END $$;

-- Only optimize auth.uid() references on Evolution-owned tables. A negative
-- lookbehind avoids nesting references that were already wrapped in a SELECT.
DO $$
DECLARE
  p record;
  q text;
  w text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'daily_score_feedback',
        'practice_plan_blocks',
        'practice_plans',
        'practice_task_events',
        'practice_tasks',
        'training_drills',
        'training_results',
        'training_session_participants',
        'training_sessions',
        'data_retention_settings',
        'team_data_retention_settings',
        'scrim_records',
        'scrim_team_reviews',
        'team_join_requests'
      )
      AND (
        COALESCE(qual, '') ~* 'auth\.uid\(\)'
        OR COALESCE(with_check, '') ~* 'auth\.uid\(\)'
      )
  LOOP
    q := CASE
      WHEN p.qual IS NULL THEN NULL
      ELSE regexp_replace(p.qual, '(?i)(?<!select )auth\.uid\(\)', '(select auth.uid())', 'g')
    END;
    w := CASE
      WHEN p.with_check IS NULL THEN NULL
      ELSE regexp_replace(p.with_check, '(?i)(?<!select )auth\.uid\(\)', '(select auth.uid())', 'g')
    END;

    IF q IS DISTINCT FROM p.qual OR w IS DISTINCT FROM p.with_check THEN
      IF q IS NOT NULL AND w IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
          p.policyname, p.schemaname, p.tablename, q, w
        );
      ELSIF q IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I USING (%s)',
          p.policyname, p.schemaname, p.tablename, q
        );
      ELSIF w IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
          p.policyname, p.schemaname, p.tablename, w
        );
      END IF;
    END IF;
  END LOOP;
END $$;
