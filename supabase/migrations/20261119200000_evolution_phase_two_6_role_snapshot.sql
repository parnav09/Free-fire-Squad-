-- Evolution Phase Two.6 — Versioned Role Snapshot
-- Additive only. Existing roster/session rows are not backfilled with guessed roles.
-- Gameplay roles are separate from team membership roles and player slot labels.

CREATE TABLE IF NOT EXISTS public.canonical_team_role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  role_key text NOT NULL CHECK (char_length(btrim(role_key)) BETWEEN 1 AND 80 AND role_key = lower(btrim(role_key))),
  role_name text NOT NULL CHECK (char_length(btrim(role_name)) BETWEEN 1 AND 80),
  role_description text CHECK (role_description IS NULL OR char_length(role_description) <= 500),
  definition_version integer NOT NULL CHECK (definition_version > 0),
  is_current boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  definition_source text NOT NULL CHECK (definition_source IN ('legacy_team_members','staff')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_team_role_definitions_id_team_unique UNIQUE (id, team_id),
  CONSTRAINT canonical_team_role_definitions_version_unique UNIQUE (team_id, role_key, definition_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS canonical_team_role_definitions_one_current
  ON public.canonical_team_role_definitions(team_id, role_key) WHERE is_current;
CREATE INDEX IF NOT EXISTS canonical_team_role_definitions_team_active_idx
  ON public.canonical_team_role_definitions(team_id, is_active, role_key);

CREATE TABLE IF NOT EXISTS public.canonical_team_role_definition_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  role_key text NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('imported','created','revised','retired')),
  previous_role_definition_id uuid,
  new_role_definition_id uuid NOT NULL,
  previous_role_name text,
  new_role_name text NOT NULL,
  new_role_description text,
  new_is_active boolean NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  idempotency_key uuid NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_team_role_definition_events_new_fk
    FOREIGN KEY (new_role_definition_id, team_id)
    REFERENCES public.canonical_team_role_definitions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_team_role_definition_events_previous_fk
    FOREIGN KEY (previous_role_definition_id, team_id)
    REFERENCES public.canonical_team_role_definitions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_team_role_definition_events_idempotency_unique UNIQUE (team_id, idempotency_key)
);

-- Import only explicit existing assigned_role values. This creates taxonomy definitions,
-- not historical session-role snapshots, and does not infer any role from player slots.
WITH legacy_roles AS (
  SELECT team_id, lower(btrim(assigned_role)) AS role_key,
         min(btrim(assigned_role)) AS role_name
  FROM public.team_members
  WHERE status = 'active' AND assigned_role IS NOT NULL AND char_length(btrim(assigned_role)) > 0
  GROUP BY team_id, lower(btrim(assigned_role))
)
INSERT INTO public.canonical_team_role_definitions(
  team_id, role_key, role_name, definition_version, is_current, is_active,
  definition_source, created_by
)
SELECT team_id, role_key, role_name, 1, true, true, 'legacy_team_members', NULL
FROM legacy_roles
ON CONFLICT (team_id, role_key, definition_version) DO NOTHING;

INSERT INTO public.canonical_team_role_definition_events(
  team_id, role_key, event_kind, previous_role_definition_id, new_role_definition_id,
  previous_role_name, new_role_name, new_role_description, new_is_active,
  reason, idempotency_key, changed_by
)
SELECT d.team_id, d.role_key, 'imported', NULL, d.id, NULL, d.role_name,
       d.role_description, d.is_active,
       'Imported exact active team_members.assigned_role text; no gameplay role semantics were inferred.',
       gen_random_uuid(), NULL
FROM public.canonical_team_role_definitions d
WHERE d.definition_source = 'legacy_team_members'
  AND NOT EXISTS (
    SELECT 1 FROM public.canonical_team_role_definition_events e
    WHERE e.new_role_definition_id = d.id AND e.event_kind = 'imported'
  );

ALTER TABLE public.canonical_session_roster_members
  ADD COLUMN IF NOT EXISTS role_definition_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS role_key_snapshot text,
  ADD COLUMN IF NOT EXISTS role_name_snapshot text,
  ADD COLUMN IF NOT EXISTS role_description_snapshot text,
  ADD COLUMN IF NOT EXISTS role_definition_version_snapshot integer,
  ADD COLUMN IF NOT EXISTS role_assignment_status_snapshot text NOT NULL DEFAULT 'unknown';

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'canonical_session_roster_members_role_definition_fk') THEN
    ALTER TABLE public.canonical_session_roster_members
      ADD CONSTRAINT canonical_session_roster_members_role_definition_fk
      FOREIGN KEY (role_definition_id_snapshot, team_id)
      REFERENCES public.canonical_team_role_definitions(id, team_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'canonical_session_roster_members_role_snapshot_shape') THEN
    ALTER TABLE public.canonical_session_roster_members
      ADD CONSTRAINT canonical_session_roster_members_role_snapshot_shape CHECK (
        (role_assignment_status_snapshot IN ('assigned','retired')
          AND role_definition_id_snapshot IS NOT NULL
          AND role_key_snapshot IS NOT NULL AND role_name_snapshot IS NOT NULL
          AND role_definition_version_snapshot IS NOT NULL)
        OR (role_assignment_status_snapshot = 'unknown'
          AND role_definition_id_snapshot IS NULL AND role_key_snapshot IS NULL
          AND role_name_snapshot IS NULL AND role_definition_version_snapshot IS NULL)
        OR (role_assignment_status_snapshot = 'unmapped'
          AND role_definition_id_snapshot IS NULL AND role_key_snapshot IS NULL
          AND role_name_snapshot IS NOT NULL AND role_definition_version_snapshot IS NULL)
      );
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS canonical_session_roster_members_role_idx
  ON public.canonical_session_roster_members(team_id, canonical_session_id, role_definition_id_snapshot);

CREATE TABLE IF NOT EXISTS public.canonical_session_match_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  canonical_session_match_id uuid NOT NULL,
  roster_member_id uuid NOT NULL,
  player_user_id uuid NOT NULL,
  role_definition_id uuid,
  role_key_snapshot text,
  role_name_snapshot text,
  role_description_snapshot text,
  role_definition_version_snapshot integer,
  role_assignment_status text NOT NULL CHECK (role_assignment_status IN ('assigned','unknown','unmapped','retired')),
  effective_at timestamptz NOT NULL,
  effective_round_label text CHECK (effective_round_label IS NULL OR char_length(effective_round_label) <= 80),
  assignment_source text NOT NULL CHECK (assignment_source IN ('session_snapshot','manual')),
  idempotency_key uuid NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_match_roles_match_team_fk
    FOREIGN KEY (canonical_session_match_id, team_id, canonical_session_id)
    REFERENCES public.canonical_session_matches(id, team_id, canonical_session_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_roles_roster_team_fk
    FOREIGN KEY (roster_member_id, team_id, canonical_session_id, player_user_id)
    REFERENCES public.canonical_session_roster_members(id, team_id, canonical_session_id, player_user_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_roles_definition_fk
    FOREIGN KEY (role_definition_id, team_id)
    REFERENCES public.canonical_team_role_definitions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_roles_one_player_per_match UNIQUE (canonical_session_match_id, player_user_id),
  CONSTRAINT canonical_session_match_roles_one_roster_entry_per_match UNIQUE (canonical_session_match_id, roster_member_id),
  CONSTRAINT canonical_session_match_roles_id_team_unique UNIQUE (id, team_id),
  CONSTRAINT canonical_session_match_roles_snapshot_shape CHECK (
    (role_assignment_status IN ('assigned','retired')
      AND role_definition_id IS NOT NULL AND role_key_snapshot IS NOT NULL
      AND role_name_snapshot IS NOT NULL AND role_definition_version_snapshot IS NOT NULL)
    OR (role_assignment_status = 'unknown'
      AND role_definition_id IS NULL AND role_key_snapshot IS NULL
      AND role_name_snapshot IS NULL AND role_definition_version_snapshot IS NULL)
    OR (role_assignment_status = 'unmapped'
      AND role_definition_id IS NULL AND role_key_snapshot IS NULL
      AND role_name_snapshot IS NOT NULL AND role_definition_version_snapshot IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS canonical_session_match_roles_team_session_match_idx
  ON public.canonical_session_match_roles(team_id, canonical_session_id, canonical_session_match_id);

CREATE TABLE IF NOT EXISTS public.canonical_session_match_role_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  canonical_session_match_id uuid NOT NULL,
  role_assignment_id uuid NOT NULL,
  roster_member_id uuid NOT NULL,
  player_user_id uuid NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('snapshot','change')),
  previous_role_definition_id uuid,
  previous_role_assignment_status text CHECK (previous_role_assignment_status IS NULL OR previous_role_assignment_status IN ('assigned','unknown','unmapped','retired')),
  previous_role_key text,
  previous_role_name text,
  previous_role_description text,
  previous_role_definition_version integer,
  new_role_definition_id uuid,
  new_role_assignment_status text NOT NULL CHECK (new_role_assignment_status IN ('assigned','unknown','unmapped','retired')),
  new_role_key text,
  new_role_name text,
  new_role_description text,
  new_role_definition_version integer,
  effective_at timestamptz NOT NULL,
  effective_round_label text CHECK (effective_round_label IS NULL OR char_length(effective_round_label) <= 80),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  idempotency_key uuid NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_match_role_events_assignment_fk
    FOREIGN KEY (role_assignment_id, team_id)
    REFERENCES public.canonical_session_match_roles(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_role_events_match_fk
    FOREIGN KEY (canonical_session_match_id, team_id, canonical_session_id)
    REFERENCES public.canonical_session_matches(id, team_id, canonical_session_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_role_events_roster_fk
    FOREIGN KEY (roster_member_id, team_id, canonical_session_id, player_user_id)
    REFERENCES public.canonical_session_roster_members(id, team_id, canonical_session_id, player_user_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_role_events_previous_definition_fk
    FOREIGN KEY (previous_role_definition_id, team_id)
    REFERENCES public.canonical_team_role_definitions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_role_events_new_definition_fk
    FOREIGN KEY (new_role_definition_id, team_id)
    REFERENCES public.canonical_team_role_definitions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_match_role_events_idempotency_unique
    UNIQUE (canonical_session_match_id, roster_member_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS canonical_session_match_role_events_timeline_idx
  ON public.canonical_session_match_role_events(team_id, canonical_session_match_id, roster_member_id, effective_at, changed_at);

ALTER TABLE public.canonical_team_role_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_team_role_definition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_match_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_match_role_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS canonical_team_role_definitions_team_read ON public.canonical_team_role_definitions;
CREATE POLICY canonical_team_role_definitions_team_read
  ON public.canonical_team_role_definitions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_team_role_definitions.team_id
      AND actor.user_id = auth.uid() AND actor.status = 'active'
  ));

DROP POLICY IF EXISTS canonical_team_role_definition_events_staff_read ON public.canonical_team_role_definition_events;
CREATE POLICY canonical_team_role_definition_events_staff_read
  ON public.canonical_team_role_definition_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_team_role_definition_events.team_id
      AND actor.user_id = auth.uid() AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS canonical_session_match_roles_team_read ON public.canonical_session_match_roles;
CREATE POLICY canonical_session_match_roles_team_read
  ON public.canonical_session_match_roles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_match_roles.team_id
      AND actor.user_id = auth.uid() AND actor.status = 'active'
  ));

DROP POLICY IF EXISTS canonical_session_match_role_events_staff_read ON public.canonical_session_match_role_events;
CREATE POLICY canonical_session_match_role_events_staff_read
  ON public.canonical_session_match_role_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_match_role_events.team_id
      AND actor.user_id = auth.uid() AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_team_role_definition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF pg_catalog.current_setting('app.evolution_role_definition_action', true) IS DISTINCT FROM 'save' THEN
      RAISE EXCEPTION 'canonical_team_role_definition_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF pg_catalog.current_setting('app.evolution_role_definition_action', true) IS DISTINCT FROM 'save'
      OR OLD.is_current IS DISTINCT FROM true OR NEW.is_current IS DISTINCT FROM false
      OR (pg_catalog.to_jsonb(NEW) - 'is_current') IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - 'is_current')
    THEN
      RAISE EXCEPTION 'canonical_team_role_definition_is_versioned' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_team_role_definition_is_non_destructive' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.snapshot_canonical_session_roster_member_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_assigned_role text;
  v_definition public.canonical_team_role_definitions;
BEGIN
  SELECT tm.assigned_role INTO v_assigned_role
  FROM public.team_members tm
  WHERE tm.id = NEW.membership_id_snapshot
    AND tm.team_id = NEW.team_id
    AND tm.user_id = NEW.player_user_id
    AND tm.status = 'active';

  NEW.role_definition_id_snapshot := NULL;
  NEW.role_key_snapshot := NULL;
  NEW.role_name_snapshot := NULL;
  NEW.role_description_snapshot := NULL;
  NEW.role_definition_version_snapshot := NULL;

  IF v_assigned_role IS NULL OR char_length(pg_catalog.btrim(v_assigned_role)) = 0 THEN
    NEW.role_assignment_status_snapshot := 'unknown';
    RETURN NEW;
  END IF;

  SELECT * INTO v_definition
  FROM public.canonical_team_role_definitions d
  WHERE d.team_id = NEW.team_id
    AND d.role_key = pg_catalog.lower(pg_catalog.btrim(v_assigned_role))
    AND d.is_current
  FOR SHARE;

  IF NOT FOUND THEN
    NEW.role_assignment_status_snapshot := 'unmapped';
    NEW.role_name_snapshot := pg_catalog.btrim(v_assigned_role);
    RETURN NEW;
  END IF;

  NEW.role_definition_id_snapshot := v_definition.id;
  NEW.role_key_snapshot := v_definition.role_key;
  NEW.role_name_snapshot := v_definition.role_name;
  NEW.role_description_snapshot := v_definition.role_description;
  NEW.role_definition_version_snapshot := v_definition.definition_version;
  NEW.role_assignment_status_snapshot := CASE WHEN v_definition.is_active THEN 'assigned' ELSE 'retired' END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_match_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF pg_catalog.current_setting('app.evolution_role_action', true) IS DISTINCT FROM 'snapshot'
      AND pg_catalog.current_setting('app.evolution_role_action', true) IS DISTINCT FROM 'change' THEN
      RAISE EXCEPTION 'canonical_session_match_role_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF pg_catalog.current_setting('app.evolution_role_action', true) IS DISTINCT FROM 'change'
      OR (pg_catalog.to_jsonb(NEW) - ARRAY[
        'role_definition_id','role_key_snapshot','role_name_snapshot','role_description_snapshot',
        'role_definition_version_snapshot','role_assignment_status','effective_at',
        'effective_round_label','assignment_source','idempotency_key','changed_by','changed_at'
      ]) IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - ARRAY[
        'role_definition_id','role_key_snapshot','role_name_snapshot','role_description_snapshot',
        'role_definition_version_snapshot','role_assignment_status','effective_at',
        'effective_round_label','assignment_source','idempotency_key','changed_by','changed_at'
      ])
    THEN
      RAISE EXCEPTION 'canonical_session_match_role_change_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_session_match_role_is_non_destructive' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.audit_canonical_session_match_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_reason text;
BEGIN
  v_reason := NULLIF(pg_catalog.btrim(pg_catalog.current_setting('app.evolution_role_reason', true)), '');
  IF v_reason IS NULL OR NEW.idempotency_key IS NULL THEN
    RAISE EXCEPTION 'canonical_session_match_role_audit_context_required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.canonical_session_match_role_events(
    team_id, canonical_session_id, canonical_session_match_id, role_assignment_id,
    roster_member_id, player_user_id, event_kind,
    previous_role_definition_id, previous_role_assignment_status, previous_role_key,
    previous_role_name, previous_role_description, previous_role_definition_version,
    new_role_definition_id, new_role_assignment_status, new_role_key, new_role_name,
    new_role_description, new_role_definition_version, effective_at,
    effective_round_label, reason, idempotency_key, changed_by
  ) VALUES (
    NEW.team_id, NEW.canonical_session_id, NEW.canonical_session_match_id, NEW.id,
    NEW.roster_member_id, NEW.player_user_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'snapshot' ELSE 'change' END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_definition_id END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_assignment_status END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_key_snapshot END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_name_snapshot END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_description_snapshot END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.role_definition_version_snapshot END,
    NEW.role_definition_id, NEW.role_assignment_status, NEW.role_key_snapshot,
    NEW.role_name_snapshot, NEW.role_description_snapshot, NEW.role_definition_version_snapshot,
    NEW.effective_at, NEW.effective_round_label, v_reason, NEW.idempotency_key, NEW.changed_by
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.snapshot_canonical_session_match_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_member public.canonical_session_roster_members;
  v_match public.canonical_session_matches;
  v_key uuid;
  v_effective_at timestamptz;
BEGIN
  IF NEW.participation_status <> 'participated' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.canonical_session_match_roles
    WHERE canonical_session_match_id = NEW.canonical_session_match_id
      AND roster_member_id = NEW.roster_member_id
  ) THEN RETURN NEW; END IF;
  SELECT * INTO v_member FROM public.canonical_session_roster_members
  WHERE id = NEW.roster_member_id
    AND team_id = NEW.team_id
    AND canonical_session_id = NEW.canonical_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'canonical_session_match_role_roster_snapshot_missing' USING ERRCODE = '23503';
  END IF;
  SELECT * INTO v_match FROM public.canonical_session_matches
  WHERE id = NEW.canonical_session_match_id
    AND team_id = NEW.team_id
    AND canonical_session_id = NEW.canonical_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'canonical_session_match_role_match_missing' USING ERRCODE = '23503';
  END IF;

  v_key := NULLIF(pg_catalog.current_setting('app.evolution_participation_idempotency_key', true), '')::uuid;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'canonical_session_match_role_participation_context_missing' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT e.changed_at INTO v_effective_at
    FROM public.canonical_session_match_participation_events e
    WHERE e.participant_id = NEW.id
    ORDER BY e.changed_at DESC LIMIT 1;
  ELSE
    v_effective_at := NEW.recorded_at;
  END IF;
  IF v_effective_at IS NULL THEN
    RAISE EXCEPTION 'canonical_session_match_role_effective_time_missing' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.set_config('app.evolution_role_action','snapshot',true);
  PERFORM pg_catalog.set_config('app.evolution_role_reason','Captured from immutable session roster role snapshot when participation was recorded or corrected to participated.',true);

  INSERT INTO public.canonical_session_match_roles(
    team_id, canonical_session_id, canonical_session_match_id, roster_member_id,
    player_user_id, role_definition_id, role_key_snapshot, role_name_snapshot,
    role_description_snapshot, role_definition_version_snapshot, role_assignment_status,
    effective_at, effective_round_label, assignment_source, idempotency_key, changed_by, changed_at
  ) VALUES (
    NEW.team_id, NEW.canonical_session_id, NEW.canonical_session_match_id, NEW.roster_member_id,
    NEW.player_user_id, v_member.role_definition_id_snapshot, v_member.role_key_snapshot,
    v_member.role_name_snapshot, v_member.role_description_snapshot,
    v_member.role_definition_version_snapshot, v_member.role_assignment_status_snapshot,
    v_effective_at, v_match.round_label, 'session_snapshot', v_key, auth.uid(), clock_timestamp()
  )
  ON CONFLICT (canonical_session_match_id, player_user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_canonical_team_role_definition(
  p_team_id uuid,
  p_role_key text,
  p_role_name text,
  p_role_description text,
  p_is_active boolean,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS public.canonical_team_role_definitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role_key text := pg_catalog.lower(pg_catalog.btrim(p_role_key));
  v_role_name text := pg_catalog.btrim(p_role_name);
  v_description text := NULLIF(pg_catalog.btrim(p_role_description), '');
  v_current public.canonical_team_role_definitions;
  v_definition public.canonical_team_role_definitions;
  v_event public.canonical_team_role_definition_events;
  v_version integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_idempotency_key IS NULL OR p_is_active IS NULL
    OR v_role_key IS NULL OR char_length(v_role_key) NOT BETWEEN 1 AND 80
    OR v_role_name IS NULL OR char_length(v_role_name) NOT BETWEEN 1 AND 80
    OR (v_description IS NOT NULL AND char_length(v_description) > 500)
    OR p_reason IS NULL OR char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'canonical_team_role_definition_arguments_invalid' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = p_team_id AND actor.user_id = auth.uid()
      AND actor.status = 'active' AND actor.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_team_id::text || ':' || v_role_key, 0));

  SELECT * INTO v_event FROM public.canonical_team_role_definition_events
  WHERE team_id = p_team_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_event.role_key <> v_role_key OR v_event.new_role_name <> v_role_name
      OR v_event.new_role_description IS DISTINCT FROM v_description
      OR v_event.new_is_active IS DISTINCT FROM p_is_active
      OR v_event.reason <> pg_catalog.btrim(p_reason)
    THEN RAISE EXCEPTION 'canonical_team_role_definition_idempotency_conflict' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_definition FROM public.canonical_team_role_definitions
    WHERE id = v_event.new_role_definition_id AND team_id = p_team_id;
    RETURN v_definition;
  END IF;

  SELECT * INTO v_current FROM public.canonical_team_role_definitions
  WHERE team_id = p_team_id AND role_key = v_role_key AND is_current
  FOR UPDATE;
  IF FOUND THEN
    IF v_current.role_name = v_role_name
      AND v_current.role_description IS NOT DISTINCT FROM v_description
      AND v_current.is_active = p_is_active
    THEN RAISE EXCEPTION 'canonical_team_role_definition_unchanged' USING ERRCODE = '23514'; END IF;
    v_version := v_current.definition_version + 1;
  ELSE
    v_version := 1;
  END IF;

  PERFORM pg_catalog.set_config('app.evolution_role_definition_action','save',true);
  IF v_current.id IS NOT NULL THEN
    UPDATE public.canonical_team_role_definitions SET is_current = false WHERE id = v_current.id;
  END IF;

  INSERT INTO public.canonical_team_role_definitions(
    team_id, role_key, role_name, role_description, definition_version,
    is_current, is_active, definition_source, created_by
  ) VALUES (
    p_team_id, v_role_key, v_role_name, v_description, v_version,
    true, p_is_active, 'staff', auth.uid()
  ) RETURNING * INTO v_definition;

  INSERT INTO public.canonical_team_role_definition_events(
    team_id, role_key, event_kind, previous_role_definition_id, new_role_definition_id,
    previous_role_name, new_role_name, new_role_description, new_is_active,
    reason, idempotency_key, changed_by
  ) VALUES (
    p_team_id, v_role_key,
    CASE WHEN v_current.id IS NULL THEN 'created' WHEN p_is_active THEN 'revised' ELSE 'retired' END,
    v_current.id, v_definition.id, v_current.role_name, v_definition.role_name,
    v_definition.role_description, v_definition.is_active, pg_catalog.btrim(p_reason),
    p_idempotency_key, auth.uid()
  );
  RETURN v_definition;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_canonical_session_match_role(
  p_match_id uuid,
  p_roster_member_id uuid,
  p_role_definition_id uuid,
  p_effective_at timestamptz,
  p_effective_round_label text,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS public.canonical_session_match_role_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_match public.canonical_session_matches;
  v_session public.canonical_sessions;
  v_member public.canonical_session_roster_members;
  v_role public.canonical_team_role_definitions;
  v_assignment public.canonical_session_match_roles;
  v_event public.canonical_session_match_role_events;
  v_started_at timestamptz;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_idempotency_key IS NULL OR p_effective_at IS NULL
    OR p_reason IS NULL OR char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500
    OR (p_effective_round_label IS NOT NULL AND char_length(p_effective_round_label) > 80)
    OR p_effective_at > clock_timestamp()
  THEN RAISE EXCEPTION 'canonical_session_match_role_arguments_invalid' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_match FROM public.canonical_session_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_match_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = v_match.canonical_session_id;
  SELECT * INTO v_member FROM public.canonical_session_roster_members WHERE id = p_roster_member_id;
  IF NOT FOUND OR v_member.team_id <> v_match.team_id
    OR v_member.canonical_session_id <> v_match.canonical_session_id
  THEN RAISE EXCEPTION 'roster_member_not_in_match_session' USING ERRCODE = '23503'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = v_match.team_id AND actor.user_id = auth.uid()
      AND actor.status = 'active' AND actor.membership_role IN ('owner','coach')
  ) THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_session FROM public.canonical_sessions
  WHERE id = v_match.canonical_session_id FOR UPDATE;
  IF v_session.archived_at IS NOT NULL OR v_session.lifecycle_status NOT IN ('in_progress','awaiting_results') THEN
    RAISE EXCEPTION 'canonical_session_match_role_requires_active_session' USING ERRCODE = '23514'; END IF;
  SELECT min(changed_at) INTO v_started_at
  FROM public.canonical_session_lifecycle_events
  WHERE canonical_session_id = v_session.id AND new_status = 'in_progress';
  IF v_started_at IS NULL OR p_effective_at < v_started_at THEN
    RAISE EXCEPTION 'canonical_session_match_role_effective_time_outside_session' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_assignment FROM public.canonical_session_match_roles
  WHERE canonical_session_match_id = v_match.id AND roster_member_id = v_member.id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_match_role_snapshot_missing' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_session_match_participants p
    WHERE p.canonical_session_match_id = v_match.id AND p.roster_member_id = v_member.id
      AND p.participation_status = 'participated'
  ) THEN RAISE EXCEPTION 'canonical_session_match_role_requires_participated_player' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_event FROM public.canonical_session_match_role_events
  WHERE canonical_session_match_id = v_match.id AND roster_member_id = v_member.id
    AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_event.new_role_definition_id IS DISTINCT FROM p_role_definition_id
      OR v_event.effective_at IS DISTINCT FROM p_effective_at
      OR v_event.effective_round_label IS DISTINCT FROM p_effective_round_label
      OR v_event.reason <> pg_catalog.btrim(p_reason)
    THEN RAISE EXCEPTION 'canonical_session_match_role_idempotency_conflict' USING ERRCODE = '22023'; END IF;
    RETURN v_event;
  END IF;

  IF p_role_definition_id IS NULL THEN
    v_status := 'unknown';
  ELSE
    SELECT * INTO v_role FROM public.canonical_team_role_definitions
    WHERE id = p_role_definition_id AND team_id = v_match.team_id
      AND is_current AND is_active
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'canonical_team_role_definition_not_active' USING ERRCODE = '23503'; END IF;
    v_status := 'assigned';
  END IF;

  IF p_effective_at < v_assignment.effective_at THEN
    RAISE EXCEPTION 'canonical_session_match_role_effective_time_precedes_previous_change' USING ERRCODE = '23514';
  END IF;
  IF v_assignment.role_definition_id IS NOT DISTINCT FROM p_role_definition_id
    AND v_assignment.role_assignment_status = v_status
  THEN RAISE EXCEPTION 'canonical_session_match_role_unchanged' USING ERRCODE = '23514'; END IF;

  PERFORM pg_catalog.set_config('app.evolution_role_action','change',true);
  PERFORM pg_catalog.set_config('app.evolution_role_reason',pg_catalog.btrim(p_reason),true);

  UPDATE public.canonical_session_match_roles
  SET role_definition_id = p_role_definition_id,
      role_key_snapshot = CASE WHEN p_role_definition_id IS NULL THEN NULL ELSE v_role.role_key END,
      role_name_snapshot = CASE WHEN p_role_definition_id IS NULL THEN NULL ELSE v_role.role_name END,
      role_description_snapshot = CASE WHEN p_role_definition_id IS NULL THEN NULL ELSE v_role.role_description END,
      role_definition_version_snapshot = CASE WHEN p_role_definition_id IS NULL THEN NULL ELSE v_role.definition_version END,
      role_assignment_status = v_status,
      effective_at = p_effective_at,
      effective_round_label = p_effective_round_label,
      assignment_source = 'manual',
      idempotency_key = p_idempotency_key,
      changed_by = auth.uid(),
      changed_at = clock_timestamp()
  WHERE id = v_assignment.id;

  SELECT * INTO v_event FROM public.canonical_session_match_role_events
  WHERE canonical_session_match_id = v_match.id AND roster_member_id = v_member.id
    AND idempotency_key = p_idempotency_key;
  RETURN v_event;
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.guard_canonical_team_role_definition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.snapshot_canonical_session_roster_member_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.guard_canonical_session_match_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.audit_canonical_session_match_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.snapshot_canonical_session_match_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS canonical_team_role_definition_guard ON public.canonical_team_role_definitions;
CREATE TRIGGER canonical_team_role_definition_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.canonical_team_role_definitions
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_canonical_team_role_definition();

DROP TRIGGER IF EXISTS canonical_session_roster_member_role_snapshot ON public.canonical_session_roster_members;
CREATE TRIGGER canonical_session_roster_member_role_snapshot
  BEFORE INSERT ON public.canonical_session_roster_members
  FOR EACH ROW EXECUTE FUNCTION evolution_private.snapshot_canonical_session_roster_member_role();

DROP TRIGGER IF EXISTS canonical_session_match_role_guard ON public.canonical_session_match_roles;
CREATE TRIGGER canonical_session_match_role_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.canonical_session_match_roles
  FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_canonical_session_match_role();

DROP TRIGGER IF EXISTS canonical_session_match_role_audit ON public.canonical_session_match_roles;
CREATE TRIGGER canonical_session_match_role_audit
  AFTER INSERT OR UPDATE ON public.canonical_session_match_roles
  FOR EACH ROW EXECUTE FUNCTION evolution_private.audit_canonical_session_match_role();

DROP TRIGGER IF EXISTS canonical_session_match_role_snapshot ON public.canonical_session_match_participants;
CREATE TRIGGER canonical_session_match_role_snapshot
  AFTER INSERT OR UPDATE OF participation_status ON public.canonical_session_match_participants
  FOR EACH ROW EXECUTE FUNCTION evolution_private.snapshot_canonical_session_match_role();

GRANT SELECT ON public.canonical_team_role_definitions,
  public.canonical_session_match_roles TO authenticated;
GRANT SELECT ON public.canonical_team_role_definition_events,
  public.canonical_session_match_role_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.canonical_team_role_definitions,
  public.canonical_team_role_definition_events, public.canonical_session_match_roles,
  public.canonical_session_match_role_events FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.save_canonical_team_role_definition(uuid,text,text,text,boolean,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_canonical_session_match_role(uuid,uuid,uuid,timestamptz,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_canonical_team_role_definition(uuid,text,text,text,boolean,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_canonical_session_match_role(uuid,uuid,uuid,timestamptz,text,text,uuid) TO authenticated;

COMMENT ON TABLE public.canonical_team_role_definitions IS
  'Team-owned, versioned gameplay-role taxonomy. Membership role and player slot are not gameplay role identity.';
COMMENT ON TABLE public.canonical_team_role_definition_events IS
  'Append-only role taxonomy creation, revision and retirement audit.';
COMMENT ON COLUMN public.canonical_session_roster_members.role_assignment_status_snapshot IS
  'assigned maps to a versioned team role; unknown means no role was assigned; unmapped preserves an explicit legacy label without guessing; retired preserves a retired definition.';
COMMENT ON TABLE public.canonical_session_match_roles IS
  'One current role snapshot per player per canonical match. Initial value is copied from the immutable session roster role; later match-specific changes do not rewrite other matches.';
COMMENT ON TABLE public.canonical_session_match_role_events IS
  'Append-only timeline of match role snapshots and effective role changes, including match/round context, actor, reason and idempotency key.';
