-- Evolution Phase Two.5 — Canonical Session Roster Snapshot
-- Additive only. No historical roster/participation is inferred from today's roster.
-- Membership IDs are copied as provenance, never retained as live FKs: leave_team()
-- physically deletes team_members rows, but this snapshot must survive that deletion.

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'canonical_session_matches_id_team_session_unique'
      AND conrelid = 'public.canonical_session_matches'::regclass
  ) THEN
    ALTER TABLE public.canonical_session_matches
      ADD CONSTRAINT canonical_session_matches_id_team_session_unique
      UNIQUE (id, team_id, canonical_session_id);
  END IF;
END;
$constraint$;

CREATE TABLE IF NOT EXISTS public.canonical_session_roster_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  session_type text NOT NULL CHECK (session_type IN ('scrim','tournament','training')),
  minimum_players smallint NOT NULL DEFAULT 1 CHECK (minimum_players BETWEEN 1 AND 10),
  maximum_players smallint NOT NULL CHECK (maximum_players BETWEEN 1 AND 10),
  require_full_roster boolean NOT NULL DEFAULT false,
  updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_roster_policy_range CHECK (minimum_players <= maximum_players),
  CONSTRAINT canonical_session_roster_policy_team_type_unique UNIQUE (team_id, session_type)
);

CREATE TABLE IF NOT EXISTS public.canonical_session_rosters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  capacity_snapshot smallint NOT NULL CHECK (capacity_snapshot BETWEEN 4 AND 10),
  minimum_players_snapshot smallint NOT NULL CHECK (minimum_players_snapshot BETWEEN 1 AND 10),
  maximum_players_snapshot smallint NOT NULL CHECK (maximum_players_snapshot BETWEEN 1 AND 10),
  require_full_roster_snapshot boolean NOT NULL DEFAULT false,
  eligible_member_count smallint NOT NULL CHECK (eligible_member_count BETWEEN 0 AND 10),
  selected_member_count smallint NOT NULL CHECK (selected_member_count BETWEEN 1 AND 10),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{32}$'),
  idempotency_key uuid NOT NULL,
  locked_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  locked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_rosters_session_team_fk
    FOREIGN KEY (canonical_session_id, team_id)
    REFERENCES public.canonical_sessions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_rosters_session_unique UNIQUE (canonical_session_id),
  CONSTRAINT canonical_session_rosters_id_team_session_unique
    UNIQUE (id, team_id, canonical_session_id),
  CONSTRAINT canonical_session_rosters_policy_range
    CHECK (minimum_players_snapshot <= maximum_players_snapshot
      AND maximum_players_snapshot <= capacity_snapshot
      AND selected_member_count <= maximum_players_snapshot
      AND eligible_member_count >= selected_member_count)
);

CREATE TABLE IF NOT EXISTS public.canonical_session_roster_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  canonical_session_roster_id uuid NOT NULL,
  membership_id_snapshot uuid NOT NULL,
  player_user_id uuid NOT NULL,
  display_name_snapshot text NOT NULL CHECK (char_length(btrim(display_name_snapshot)) BETWEEN 1 AND 80),
  player_number_snapshot smallint CHECK (player_number_snapshot BETWEEN 1 AND 10),
  membership_role_snapshot text NOT NULL CHECK (membership_role_snapshot IN ('owner','coach','player')),
  membership_status_snapshot text NOT NULL DEFAULT 'active' CHECK (membership_status_snapshot = 'active'),
  selection_status text NOT NULL DEFAULT 'available'
    CHECK (selection_status IN ('available','invited','selected','confirmed')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_roster_members_roster_team_fk
    FOREIGN KEY (canonical_session_roster_id, team_id, canonical_session_id)
    REFERENCES public.canonical_session_rosters(id, team_id, canonical_session_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_roster_members_one_player_per_session
    UNIQUE (canonical_session_id, player_user_id),
  CONSTRAINT canonical_session_roster_members_one_membership_per_session
    UNIQUE (canonical_session_id, membership_id_snapshot),
  CONSTRAINT canonical_session_roster_members_id_team_session_unique
    UNIQUE (id, team_id, canonical_session_id),
  CONSTRAINT canonical_session_roster_members_id_team_session_player_unique
    UNIQUE (id, team_id, canonical_session_id, player_user_id)
);

CREATE TABLE IF NOT EXISTS public.canonical_session_roster_member_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  roster_member_id uuid NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('snapshot','selection')),
  previous_status text CHECK (previous_status IS NULL OR previous_status IN ('available','invited','selected','confirmed')),
  new_status text NOT NULL CHECK (new_status IN ('available','invited','selected','confirmed')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  idempotency_key uuid NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_roster_member_events_member_team_fk
    FOREIGN KEY (roster_member_id, team_id, canonical_session_id)
    REFERENCES public.canonical_session_roster_members(id, team_id, canonical_session_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_roster_member_events_idempotency_unique
    UNIQUE (roster_member_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.canonical_session_match_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  canonical_session_match_id uuid NOT NULL,
  roster_member_id uuid NOT NULL,
  player_user_id uuid NOT NULL,
  participation_status text NOT NULL CHECK (participation_status IN ('participated','absent','substituted')),
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_match_participants_match_team_fk
    FOREIGN KEY (canonical_session_match_id, team_id, canonical_session_id)
    REFERENCES public.canonical_session_matches(id, team_id, canonical_session_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_participants_roster_team_fk
    FOREIGN KEY (roster_member_id, team_id, canonical_session_id, player_user_id)
    REFERENCES public.canonical_session_roster_members(id, team_id, canonical_session_id, player_user_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_participants_one_player_per_match
    UNIQUE (canonical_session_match_id, player_user_id),
  CONSTRAINT canonical_session_match_participants_one_roster_entry_per_match
    UNIQUE (canonical_session_match_id, roster_member_id),
  CONSTRAINT canonical_session_match_participants_id_team_unique UNIQUE (id, team_id)
);

CREATE TABLE IF NOT EXISTS public.canonical_session_match_participation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('record','correction')),
  previous_status text CHECK (previous_status IS NULL OR previous_status IN ('participated','absent','substituted')),
  new_status text NOT NULL CHECK (new_status IN ('participated','absent','substituted')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  idempotency_key uuid NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_match_participation_events_participant_team_fk
    FOREIGN KEY (participant_id, team_id)
    REFERENCES public.canonical_session_match_participants(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_participation_events_idempotency_unique
    UNIQUE (participant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS canonical_session_rosters_team_session_idx
  ON public.canonical_session_rosters(team_id, canonical_session_id);
CREATE INDEX IF NOT EXISTS canonical_session_roster_members_team_session_idx
  ON public.canonical_session_roster_members(team_id, canonical_session_id, player_number_snapshot);
CREATE INDEX IF NOT EXISTS canonical_session_roster_events_session_time_idx
  ON public.canonical_session_roster_member_events(canonical_session_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS canonical_session_match_participants_session_idx
  ON public.canonical_session_match_participants(team_id, canonical_session_id, canonical_session_match_id);
CREATE INDEX IF NOT EXISTS canonical_session_match_participation_events_session_time_idx
  ON public.canonical_session_match_participation_events(canonical_session_id, changed_at DESC);

ALTER TABLE public.canonical_session_roster_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_roster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_roster_member_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_match_participation_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.canonical_session_roster_policies,
  public.canonical_session_rosters, public.canonical_session_roster_members,
  public.canonical_session_roster_member_events,
  public.canonical_session_match_participants,
  public.canonical_session_match_participation_events
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.canonical_session_roster_policies TO authenticated;
GRANT SELECT, INSERT ON public.canonical_session_rosters TO authenticated;
GRANT SELECT, INSERT, UPDATE (selection_status) ON public.canonical_session_roster_members TO authenticated;
GRANT SELECT ON public.canonical_session_roster_member_events TO authenticated;
GRANT SELECT, INSERT ON public.canonical_session_match_participants TO authenticated;
GRANT UPDATE (participation_status) ON public.canonical_session_match_participants TO authenticated;
GRANT SELECT ON public.canonical_session_match_participation_events TO authenticated;

DROP POLICY IF EXISTS canonical_session_roster_policies_staff_read ON public.canonical_session_roster_policies;
CREATE POLICY canonical_session_roster_policies_staff_read
  ON public.canonical_session_roster_policies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_roster_policies.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));
DROP POLICY IF EXISTS canonical_session_roster_policies_staff_insert ON public.canonical_session_roster_policies;
CREATE POLICY canonical_session_roster_policies_staff_insert
  ON public.canonical_session_roster_policies FOR INSERT TO authenticated
  WITH CHECK (updated_by = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_roster_policies.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));
DROP POLICY IF EXISTS canonical_session_roster_policies_staff_update ON public.canonical_session_roster_policies;
CREATE POLICY canonical_session_roster_policies_staff_update
  ON public.canonical_session_roster_policies FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_roster_policies.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ))
  WITH CHECK (updated_by = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_roster_policies.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS canonical_session_rosters_team_read ON public.canonical_session_rosters;
CREATE POLICY canonical_session_rosters_team_read
  ON public.canonical_session_rosters FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_rosters.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
  ));
DROP POLICY IF EXISTS canonical_session_rosters_staff_insert ON public.canonical_session_rosters;
CREATE POLICY canonical_session_rosters_staff_insert
  ON public.canonical_session_rosters FOR INSERT TO authenticated
  WITH CHECK (locked_by = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_rosters.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS canonical_session_roster_members_team_read ON public.canonical_session_roster_members;
CREATE POLICY canonical_session_roster_members_team_read
  ON public.canonical_session_roster_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_roster_members.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
  ));
DROP POLICY IF EXISTS canonical_session_roster_members_staff_insert ON public.canonical_session_roster_members;
CREATE POLICY canonical_session_roster_members_staff_insert
  ON public.canonical_session_roster_members FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_roster_members.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));
DROP POLICY IF EXISTS canonical_session_roster_members_staff_update ON public.canonical_session_roster_members;
CREATE POLICY canonical_session_roster_members_staff_update
  ON public.canonical_session_roster_members FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_roster_members.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_roster_members.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS canonical_session_roster_member_events_staff_read ON public.canonical_session_roster_member_events;
CREATE POLICY canonical_session_roster_member_events_staff_read
  ON public.canonical_session_roster_member_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_roster_member_events.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS canonical_session_match_participants_team_read ON public.canonical_session_match_participants;
CREATE POLICY canonical_session_match_participants_team_read
  ON public.canonical_session_match_participants FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_match_participants.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
  ));
DROP POLICY IF EXISTS canonical_session_match_participants_staff_insert ON public.canonical_session_match_participants;
CREATE POLICY canonical_session_match_participants_staff_insert
  ON public.canonical_session_match_participants FOR INSERT TO authenticated
  WITH CHECK (recorded_by = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_match_participants.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));
DROP POLICY IF EXISTS canonical_session_match_participants_staff_update ON public.canonical_session_match_participants;
CREATE POLICY canonical_session_match_participants_staff_update
  ON public.canonical_session_match_participants FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_match_participants.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_match_participants.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS canonical_session_match_participation_events_staff_read ON public.canonical_session_match_participation_events;
CREATE POLICY canonical_session_match_participation_events_staff_read
  ON public.canonical_session_match_participation_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_match_participation_events.team_id
      AND actor.user_id = (SELECT auth.uid()) AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));

CREATE SCHEMA IF NOT EXISTS evolution_private;
REVOKE ALL ON SCHEMA evolution_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_roster_header()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP <> 'INSERT'
    OR pg_catalog.current_setting('app.evolution_roster_action', true) IS DISTINCT FROM 'lock'
  THEN
    RAISE EXCEPTION 'canonical_session_roster_rpc_required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_roster_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF pg_catalog.current_setting('app.evolution_roster_action', true) IS DISTINCT FROM 'lock' THEN
      RAISE EXCEPTION 'canonical_session_roster_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF pg_catalog.current_setting('app.evolution_roster_action', true) IS DISTINCT FROM 'status'
      OR (pg_catalog.to_jsonb(NEW) - 'selection_status')
        IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - 'selection_status')
    THEN
      RAISE EXCEPTION 'canonical_session_roster_status_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_session_roster_is_non_destructive' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.audit_canonical_session_roster_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_key uuid;
  v_reason text;
BEGIN
  v_key := NULLIF(pg_catalog.current_setting('app.evolution_roster_idempotency_key', true), '')::uuid;
  v_reason := NULLIF(pg_catalog.btrim(pg_catalog.current_setting('app.evolution_roster_reason', true)), '');
  IF v_key IS NULL OR v_reason IS NULL THEN
    RAISE EXCEPTION 'canonical_session_roster_audit_context_required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.canonical_session_roster_member_events(
    team_id, canonical_session_id, roster_member_id, event_kind,
    previous_status, new_status, reason, idempotency_key, changed_by
  ) VALUES (
    NEW.team_id, NEW.canonical_session_id, NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'snapshot' ELSE 'selection' END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.selection_status END,
    NEW.selection_status, v_reason, v_key, auth.uid()
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_match_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF pg_catalog.current_setting('app.evolution_participation_action', true) IS DISTINCT FROM 'record' THEN
      RAISE EXCEPTION 'canonical_match_participation_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF pg_catalog.current_setting('app.evolution_participation_action', true) IS DISTINCT FROM 'correct'
      OR (pg_catalog.to_jsonb(NEW) - 'participation_status')
        IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - 'participation_status')
    THEN
      RAISE EXCEPTION 'canonical_match_participation_correction_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_match_participation_is_non_destructive' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.audit_canonical_session_match_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_key uuid;
  v_reason text;
BEGIN
  v_key := NULLIF(pg_catalog.current_setting('app.evolution_participation_idempotency_key', true), '')::uuid;
  v_reason := NULLIF(pg_catalog.btrim(pg_catalog.current_setting('app.evolution_participation_reason', true)), '');
  IF v_key IS NULL OR v_reason IS NULL THEN
    RAISE EXCEPTION 'canonical_match_participation_audit_context_required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.canonical_session_match_participation_events(
    team_id, canonical_session_id, participant_id, event_kind,
    previous_status, new_status, reason, idempotency_key, changed_by
  ) VALUES (
    NEW.team_id, NEW.canonical_session_id, NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'record' ELSE 'correction' END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.participation_status END,
    NEW.participation_status, v_reason, v_key, auth.uid()
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.guard_canonical_session_roster_header() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.guard_canonical_session_roster_member() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.audit_canonical_session_roster_member() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.guard_canonical_session_match_participant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.audit_canonical_session_match_participation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS canonical_session_roster_header_guard ON public.canonical_session_rosters;
CREATE TRIGGER canonical_session_roster_header_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.canonical_session_rosters
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_canonical_session_roster_header();

DROP TRIGGER IF EXISTS canonical_session_roster_member_guard ON public.canonical_session_roster_members;
CREATE TRIGGER canonical_session_roster_member_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.canonical_session_roster_members
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_canonical_session_roster_member();
DROP TRIGGER IF EXISTS canonical_session_roster_member_audit ON public.canonical_session_roster_members;
CREATE TRIGGER canonical_session_roster_member_audit
  AFTER INSERT OR UPDATE OF selection_status ON public.canonical_session_roster_members
  FOR EACH ROW EXECUTE FUNCTION evolution_private.audit_canonical_session_roster_member();

DROP TRIGGER IF EXISTS canonical_session_match_participant_guard ON public.canonical_session_match_participants;
CREATE TRIGGER canonical_session_match_participant_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.canonical_session_match_participants
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_canonical_session_match_participant();
DROP TRIGGER IF EXISTS canonical_session_match_participation_audit ON public.canonical_session_match_participants;
CREATE TRIGGER canonical_session_match_participation_audit
  AFTER INSERT OR UPDATE OF participation_status ON public.canonical_session_match_participants
  FOR EACH ROW EXECUTE FUNCTION evolution_private.audit_canonical_session_match_participation();

CREATE OR REPLACE FUNCTION public.configure_canonical_session_roster_policy(
  p_team_id uuid,
  p_session_type text,
  p_minimum_players smallint,
  p_maximum_players smallint,
  p_require_full_roster boolean DEFAULT false
)
RETURNS public.canonical_session_roster_policies
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_capacity integer;
  v_policy public.canonical_session_roster_policies;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = p_team_id AND actor.user_id = auth.uid()
      AND actor.status = 'active' AND actor.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  SELECT coalesce(
    (SELECT NULLIF(ts.setting_value #>> '{}','')::integer
     FROM public.team_settings ts
     WHERE ts.team_id = p_team_id AND ts.setting_key = 'roster_capacity'),
    CASE WHEN EXISTS (
      SELECT 1 FROM public.team_settings ts
      WHERE ts.team_id = p_team_id AND ts.setting_key = 'fifth_player'
        AND ts.setting_value = 'true'::jsonb
    ) THEN 5 ELSE 4 END
  ) INTO v_capacity;

  IF v_capacity < 4 OR v_capacity > 10
    OR p_minimum_players IS NULL OR p_maximum_players IS NULL
    OR p_minimum_players < 1 OR p_maximum_players < p_minimum_players
    OR p_maximum_players > v_capacity OR p_maximum_players > 10
  THEN RAISE EXCEPTION 'roster_policy_outside_configured_team_capacity' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.canonical_session_roster_policies(
    team_id, session_type, minimum_players, maximum_players, require_full_roster, updated_by
  ) VALUES (
    p_team_id, p_session_type, p_minimum_players, p_maximum_players,
    coalesce(p_require_full_roster,false), auth.uid()
  )
  ON CONFLICT (team_id, session_type) DO UPDATE
  SET minimum_players = EXCLUDED.minimum_players,
      maximum_players = EXCLUDED.maximum_players,
      require_full_roster = EXCLUDED.require_full_roster,
      updated_by = EXCLUDED.updated_by,
      updated_at = clock_timestamp()
  RETURNING * INTO v_policy;
  RETURN v_policy;
END;
$function$;

CREATE OR REPLACE FUNCTION public.lock_canonical_session_roster(
  p_session_id uuid,
  p_selected_member_ids uuid[],
  p_invited_member_ids uuid[],
  p_idempotency_key uuid
)
RETURNS public.canonical_session_rosters
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_session public.canonical_sessions;
  v_existing public.canonical_session_rosters;
  v_roster public.canonical_session_rosters;
  v_capacity integer;
  v_minimum integer;
  v_maximum integer;
  v_require_full boolean;
  v_selected uuid[] := coalesce(p_selected_member_ids, ARRAY[]::uuid[]);
  v_invited uuid[] := coalesce(p_invited_member_ids, ARRAY[]::uuid[]);
  v_selected_count integer;
  v_eligible_count integer;
  v_payload_hash text;
  v_member record;
  v_member_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'roster_snapshot_idempotency_key_required' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = v_session.team_id AND actor.user_id = auth.uid()
      AND actor.status = 'active' AND actor.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_session.archived_at IS NOT NULL OR v_session.lifecycle_status NOT IN ('draft','scheduled') THEN
    RAISE EXCEPTION 'roster_snapshot_requires_draft_or_scheduled_session' USING ERRCODE = '23514';
  END IF;

  SELECT md5(
    'selected=' || coalesce((SELECT string_agg(ids.member_id::text, ',' ORDER BY ids.member_id)
      FROM unnest(v_selected) AS ids(member_id)), '') ||
    '|invited=' || coalesce((SELECT string_agg(ids.member_id::text, ',' ORDER BY ids.member_id)
      FROM unnest(v_invited) AS ids(member_id)), '')
  ) INTO v_payload_hash;
  SELECT * INTO v_existing FROM public.canonical_session_rosters
  WHERE canonical_session_id = p_session_id;
  IF FOUND THEN
    IF v_existing.idempotency_key = p_idempotency_key AND v_existing.payload_hash = v_payload_hash THEN
      RETURN v_existing;
    END IF;
    RAISE EXCEPTION 'canonical_session_roster_already_locked' USING ERRCODE = '23505';
  END IF;

  IF cardinality(v_selected) <> (SELECT count(DISTINCT x) FROM unnest(v_selected) AS t(x))
    OR cardinality(v_invited) <> (SELECT count(DISTINCT x) FROM unnest(v_invited) AS t(x))
  THEN RAISE EXCEPTION 'duplicate_roster_membership_id' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_selected) s(id) JOIN unnest(v_invited) i(id) USING (id)) THEN
    RAISE EXCEPTION 'roster_member_cannot_be_selected_and_invited' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(
    (SELECT NULLIF(ts.setting_value #>> '{}','')::integer
     FROM public.team_settings ts
     WHERE ts.team_id = v_session.team_id AND ts.setting_key = 'roster_capacity'),
    CASE WHEN EXISTS (
      SELECT 1 FROM public.team_settings ts
      WHERE ts.team_id = v_session.team_id AND ts.setting_key = 'fifth_player'
        AND ts.setting_value = 'true'::jsonb
    ) THEN 5 ELSE 4 END
  ) INTO v_capacity;

  SELECT p.minimum_players, p.maximum_players, p.require_full_roster
  INTO v_minimum, v_maximum, v_require_full
  FROM public.canonical_session_roster_policies p
  WHERE p.team_id = v_session.team_id AND p.session_type = v_session.session_type;
  IF NOT FOUND THEN
    v_minimum := 1;
    v_maximum := v_capacity;
    v_require_full := false;
  END IF;

  SELECT count(*) INTO v_eligible_count
  FROM public.team_members tm
  WHERE tm.team_id = v_session.team_id AND tm.status = 'active'
    AND tm.player_number BETWEEN 1 AND v_capacity;
  v_selected_count := cardinality(v_selected);

  IF v_capacity < 4 OR v_capacity > 10 THEN
    RAISE EXCEPTION 'configured_team_roster_capacity_invalid' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_session.team_id AND tm.status = 'active'
      AND tm.player_number BETWEEN 1 AND v_capacity
    GROUP BY tm.player_number HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'duplicate_active_player_slot' USING ERRCODE = '23505'; END IF;

  IF v_selected_count < v_minimum OR v_selected_count > v_maximum
    OR (v_require_full AND v_selected_count <> v_maximum)
  THEN RAISE EXCEPTION 'selected_roster_size_outside_session_policy' USING ERRCODE = '22023'; END IF;
  IF v_eligible_count > 10 OR v_selected_count > v_eligible_count THEN
    RAISE EXCEPTION 'eligible_roster_exceeds_supported_capacity' USING ERRCODE = '22023'; END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_selected || v_invited) requested(member_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = requested.member_id AND tm.team_id = v_session.team_id
        AND tm.status = 'active' AND tm.player_number BETWEEN 1 AND v_capacity
    )
  ) THEN RAISE EXCEPTION 'roster_members_must_be_active_eligible_team_members' USING ERRCODE = '22023'; END IF;

  PERFORM pg_catalog.set_config('app.evolution_roster_action','lock',true);
  INSERT INTO public.canonical_session_rosters(
    team_id, canonical_session_id, capacity_snapshot, minimum_players_snapshot,
    maximum_players_snapshot, require_full_roster_snapshot, eligible_member_count,
    selected_member_count, payload_hash, idempotency_key, locked_by
  ) VALUES (
    v_session.team_id, v_session.id, v_capacity, v_minimum, v_maximum,
    v_require_full, v_eligible_count, v_selected_count, v_payload_hash,
    p_idempotency_key, auth.uid()
  ) RETURNING * INTO v_roster;

  FOR v_member IN
    SELECT tm.id, tm.user_id, tm.display_name, tm.player_number, tm.membership_role
    FROM public.team_members tm
    WHERE tm.team_id = v_session.team_id AND tm.status = 'active'
      AND tm.player_number BETWEEN 1 AND v_capacity
    ORDER BY tm.player_number, tm.id
  LOOP
    v_member_status := CASE
      WHEN v_member.id = ANY(v_selected) THEN 'selected'
      WHEN v_member.id = ANY(v_invited) THEN 'invited'
      ELSE 'available'
    END;
    PERFORM pg_catalog.set_config(
      'app.evolution_roster_idempotency_key',
      md5(p_idempotency_key::text || ':' || v_member.id::text)::uuid::text, true
    );
    PERFORM pg_catalog.set_config('app.evolution_roster_reason','Roster identity captured at lock time',true);
    INSERT INTO public.canonical_session_roster_members(
      team_id, canonical_session_id, canonical_session_roster_id,
      membership_id_snapshot, player_user_id, display_name_snapshot,
      player_number_snapshot, membership_role_snapshot, selection_status, created_by
    ) VALUES (
      v_session.team_id, v_session.id, v_roster.id,
      v_member.id, v_member.user_id,
      left(coalesce(nullif(btrim(v_member.display_name),''),'Player'),80),
      v_member.player_number, v_member.membership_role, v_member_status, auth.uid()
    );
  END LOOP;

  RETURN v_roster;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_canonical_session_roster_member_status(
  p_roster_member_id uuid,
  p_target_status text,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS public.canonical_session_roster_members
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_member public.canonical_session_roster_members;
  v_session public.canonical_sessions;
  v_event public.canonical_session_roster_member_events;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_idempotency_key IS NULL OR p_reason IS NULL
    OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'roster_status_arguments_invalid' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_member FROM public.canonical_session_roster_members
  WHERE id = p_roster_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_roster_member_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = v_member.canonical_session_id;
  IF NOT FOUND OR v_session.team_id <> v_member.team_id THEN
    RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = v_member.team_id AND actor.user_id = auth.uid()
      AND actor.status = 'active' AND actor.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  PERFORM 1 FROM public.canonical_sessions WHERE id = v_session.id FOR UPDATE;
  SELECT * INTO v_member FROM public.canonical_session_roster_members
  WHERE id = p_roster_member_id FOR UPDATE;
  IF v_session.archived_at IS NOT NULL OR v_session.lifecycle_status NOT IN ('draft','scheduled') THEN
    RAISE EXCEPTION 'roster_selection_locked_after_session_start' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_event FROM public.canonical_session_roster_member_events
  WHERE roster_member_id = v_member.id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_event.event_kind <> 'selection' OR v_event.new_status <> p_target_status
      OR v_event.reason <> btrim(p_reason)
    THEN RAISE EXCEPTION 'roster_status_idempotency_key_reused_with_different_payload' USING ERRCODE = '22023'; END IF;
    RETURN v_member;
  END IF;

  IF NOT (
    (v_member.selection_status = 'available' AND p_target_status IN ('invited','selected'))
    OR (v_member.selection_status = 'invited' AND p_target_status IN ('selected','confirmed'))
    OR (v_member.selection_status = 'selected' AND p_target_status = 'confirmed')
  ) THEN RAISE EXCEPTION 'invalid_roster_selection_transition' USING ERRCODE = '23514'; END IF;

  PERFORM pg_catalog.set_config('app.evolution_roster_action','status',true);
  PERFORM pg_catalog.set_config('app.evolution_roster_idempotency_key',p_idempotency_key::text,true);
  PERFORM pg_catalog.set_config('app.evolution_roster_reason',btrim(p_reason),true);
  UPDATE public.canonical_session_roster_members
  SET selection_status = p_target_status
  WHERE id = v_member.id
  RETURNING * INTO v_member;
  RETURN v_member;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_canonical_match_participation(
  p_match_id uuid,
  p_roster_member_id uuid,
  p_participation_status text,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS public.canonical_session_match_participants
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_match public.canonical_session_matches;
  v_session public.canonical_sessions;
  v_member public.canonical_session_roster_members;
  v_existing public.canonical_session_match_participants;
  v_event public.canonical_session_match_participation_events;
  v_participant public.canonical_session_match_participants;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_idempotency_key IS NULL OR p_reason IS NULL
    OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'participation_arguments_invalid' USING ERRCODE = '22023'; END IF;
  IF p_participation_status NOT IN ('participated','absent','substituted') THEN
    RAISE EXCEPTION 'invalid_match_participation_status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match FROM public.canonical_session_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_match_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = v_match.canonical_session_id;
  SELECT * INTO v_member FROM public.canonical_session_roster_members WHERE id = p_roster_member_id;
  IF NOT FOUND OR v_member.canonical_session_id <> v_match.canonical_session_id
    OR v_member.team_id <> v_match.team_id
  THEN RAISE EXCEPTION 'roster_member_not_in_match_session' USING ERRCODE = '23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = v_match.team_id AND actor.user_id = auth.uid()
      AND actor.status = 'active' AND actor.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  PERFORM 1 FROM public.canonical_sessions WHERE id = v_session.id FOR UPDATE;
  IF v_session.archived_at IS NOT NULL OR v_session.lifecycle_status NOT IN ('in_progress','awaiting_results') THEN
    RAISE EXCEPTION 'match_participation_requires_active_session' USING ERRCODE = '23514'; END IF;
  IF v_member.selection_status NOT IN ('selected','confirmed') THEN
    RAISE EXCEPTION 'match_participant_must_be_selected_or_confirmed' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_existing FROM public.canonical_session_match_participants
  WHERE canonical_session_match_id = v_match.id AND player_user_id = v_member.player_user_id
  FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO v_event FROM public.canonical_session_match_participation_events
    WHERE participant_id = v_existing.id AND idempotency_key = p_idempotency_key;
    IF FOUND AND v_event.event_kind = 'record' AND v_event.new_status = p_participation_status
      AND v_event.reason = btrim(p_reason) THEN RETURN v_existing; END IF;
    RAISE EXCEPTION 'match_participation_already_recorded_use_correction_rpc' USING ERRCODE = '23505';
  END IF;

  PERFORM pg_catalog.set_config('app.evolution_participation_action','record',true);
  PERFORM pg_catalog.set_config('app.evolution_participation_idempotency_key',p_idempotency_key::text,true);
  PERFORM pg_catalog.set_config('app.evolution_participation_reason',btrim(p_reason),true);
  INSERT INTO public.canonical_session_match_participants(
    team_id, canonical_session_id, canonical_session_match_id, roster_member_id,
    player_user_id, participation_status, recorded_by
  ) VALUES (
    v_match.team_id, v_match.canonical_session_id, v_match.id, v_member.id,
    v_member.player_user_id, p_participation_status, auth.uid()
  ) RETURNING * INTO v_participant;
  RETURN v_participant;
END;
$function$;

CREATE OR REPLACE FUNCTION public.correct_canonical_match_participation(
  p_participant_id uuid,
  p_new_status text,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS public.canonical_session_match_participants
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_participant public.canonical_session_match_participants;
  v_session public.canonical_sessions;
  v_event public.canonical_session_match_participation_events;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_idempotency_key IS NULL OR p_reason IS NULL
    OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'participation_correction_arguments_invalid' USING ERRCODE = '22023'; END IF;
  IF p_new_status NOT IN ('participated','absent','substituted') THEN
    RAISE EXCEPTION 'invalid_match_participation_status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_participant FROM public.canonical_session_match_participants
  WHERE id = p_participant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_match_participant_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = v_participant.canonical_session_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = v_participant.team_id AND actor.user_id = auth.uid()
      AND actor.status = 'active' AND actor.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  PERFORM 1 FROM public.canonical_sessions WHERE id = v_session.id FOR UPDATE;
  SELECT * INTO v_participant FROM public.canonical_session_match_participants
  WHERE id = p_participant_id FOR UPDATE;
  IF v_session.archived_at IS NOT NULL OR v_session.lifecycle_status NOT IN ('in_progress','awaiting_results') THEN
    RAISE EXCEPTION 'closed_session_participation_is_read_only' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_event FROM public.canonical_session_match_participation_events
  WHERE participant_id = v_participant.id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_event.event_kind <> 'correction' OR v_event.new_status <> p_new_status
      OR v_event.reason <> btrim(p_reason)
    THEN RAISE EXCEPTION 'participation_idempotency_key_reused_with_different_payload' USING ERRCODE = '22023'; END IF;
    RETURN v_participant;
  END IF;
  IF v_participant.participation_status = p_new_status THEN
    RAISE EXCEPTION 'participation_status_unchanged' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.set_config('app.evolution_participation_action','correct',true);
  PERFORM pg_catalog.set_config('app.evolution_participation_idempotency_key',p_idempotency_key::text,true);
  PERFORM pg_catalog.set_config('app.evolution_participation_reason',btrim(p_reason),true);
  UPDATE public.canonical_session_match_participants
  SET participation_status = p_new_status
  WHERE id = v_participant.id
  RETURNING * INTO v_participant;
  RETURN v_participant;
END;
$function$;

REVOKE ALL ON FUNCTION public.configure_canonical_session_roster_policy(uuid,text,smallint,smallint,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lock_canonical_session_roster(uuid,uuid[],uuid[],uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_canonical_session_roster_member_status(uuid,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_canonical_match_participation(uuid,uuid,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_canonical_match_participation(uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.configure_canonical_session_roster_policy(uuid,text,smallint,smallint,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_canonical_session_roster(uuid,uuid[],uuid[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_canonical_session_roster_member_status(uuid,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_canonical_match_participation(uuid,uuid,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_canonical_match_participation(uuid,text,text,uuid) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.canonical_session_roster_member_events FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.canonical_session_match_participation_events FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON public.canonical_session_rosters FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON public.canonical_session_roster_policies,
  public.canonical_session_rosters, public.canonical_session_roster_members,
  public.canonical_session_match_participants FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.canonical_session_rosters IS
  'Immutable roster-lock header with team capacity and session-type policy snapshots. It records when the eligible roster was captured.';
COMMENT ON TABLE public.canonical_session_roster_members IS
  'Historical player identity and membership provenance copied at roster lock. No FK to team_members/auth.users: the snapshot survives membership/account removal and IGN changes.';
COMMENT ON TABLE public.canonical_session_roster_member_events IS
  'Append-only audit of roster snapshot creation and invited/selected/confirmed status changes.';
COMMENT ON TABLE public.canonical_session_match_participants IS
  'One participant state per canonical match/player, tied to the same session roster snapshot. Does not itself encode substitution links; those belong to Point 2.7.';
COMMENT ON TABLE public.canonical_session_match_participation_events IS
  'Append-only audit of actual per-match participation records and corrections.';
