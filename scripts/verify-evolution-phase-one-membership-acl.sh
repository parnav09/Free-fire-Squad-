#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to the disposable CI PostgreSQL service}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122000000_phase_one_membership_update_guard.sql"

echo "Disposable PostgreSQL version:"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SHOW server_version"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

CREATE TABLE public.teams (
  id uuid PRIMARY KEY
);

CREATE TABLE public.team_settings (
  team_id uuid NOT NULL,
  setting_key text NOT NULL,
  setting_value jsonb,
  PRIMARY KEY (team_id, setting_key)
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  player_number smallint,
  assigned_role text,
  membership_role text NOT NULL CHECK (membership_role IN ('owner','coach','player')),
  status text NOT NULL CHECK (status IN ('pending','active')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  character_loadout jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
     WHERE tm.team_id = p_team_id
       AND tm.user_id = auth.uid()
       AND tm.status = 'active'
       AND tm.membership_role = 'owner'
  );
$function$;

CREATE OR REPLACE FUNCTION public.assign_member(
  p_member uuid,
  p_player smallint,
  p_activate boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t uuid;
  cap integer;
BEGIN
  SELECT team_id INTO t FROM public.team_members WHERE id = p_member;
  IF t IS NULL OR NOT public.is_team_owner(t) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT coalesce(
    (setting_value #>> '{}')::integer,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.team_settings
       WHERE team_id = t AND setting_key = 'fifth_player' AND setting_value = 'true'::jsonb
    ) THEN 5 ELSE 4 END
  )
    INTO cap
    FROM public.team_settings
   WHERE team_id = t AND setting_key = 'roster_capacity';

  IF cap IS NULL THEN
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.team_settings
       WHERE team_id = t AND setting_key = 'fifth_player' AND setting_value = 'true'::jsonb
    ) THEN 5 ELSE 4 END INTO cap;
  END IF;

  IF p_player < 1 OR p_player > cap THEN
    RAISE EXCEPTION 'Player slot is outside configured roster capacity';
  END IF;

  UPDATE public.team_members
     SET player_number = p_player,
         status = CASE WHEN p_activate THEN 'active' ELSE status END
   WHERE id = p_member;
END;
$function$;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tm_select ON public.team_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_owner(team_id));
CREATE POLICY tm_update_character_loadout ON public.team_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_team_owner(team_id))
  WITH CHECK (user_id = auth.uid() OR public.is_team_owner(team_id));

GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_member(uuid,smallint,boolean) TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.team_members TO authenticated;

INSERT INTO public.teams(id) VALUES
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');

INSERT INTO public.team_members
  (id,team_id,user_id,display_name,player_number,assigned_role,membership_role,status)
VALUES
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Owner',1,'Sniper','owner','active'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','Member',2,'Secondary Rusher','player','active'),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','Other Team',1,'Primary Rusher','player','active');
SQL

# Apply only the targeted migration under test to the disposable database.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

# Verify the least-privilege column grant and RPC execution boundary.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  fn oid := 'public.set_member_assignment(uuid,smallint,text,boolean)'::regprocedure;
BEGIN
  IF has_table_privilege('authenticated','public.team_members','UPDATE') THEN
    RAISE EXCEPTION 'authenticated retains table-level UPDATE';
  END IF;
  IF NOT has_column_privilege('authenticated','public.team_members','character_loadout','UPDATE') THEN
    RAISE EXCEPTION 'self-service character_loadout UPDATE was not preserved';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.column_privileges
     WHERE table_schema='public' AND table_name='team_members'
       AND grantee='authenticated' AND privilege_type='UPDATE'
       AND column_name <> 'character_loadout'
  ) THEN
    RAISE EXCEPTION 'authenticated retains UPDATE on a protected membership column';
  END IF;
  IF has_function_privilege('anon',fn,'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute set_member_assignment';
  END IF;
  IF NOT has_function_privilege('authenticated',fn,'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute set_member_assignment';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
     WHERE p.oid=fn AND a.grantee=0 AND a.privilege_type='EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC retains EXECUTE on set_member_assignment';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=fn) THEN
    RAISE EXCEPTION 'set_member_assignment is not SECURITY DEFINER';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid=fn AND proconfig @> ARRAY['search_path=pg_catalog, public']
  ) THEN
    RAISE EXCEPTION 'set_member_assignment search_path is not pinned safely';
  END IF;
END;
$$;
SQL

# A normal member cannot edit identity, role, status, slot, or display columns.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '30000000-0000-4000-8000-000000000002';
DO $$
DECLARE
  denied boolean;
  affected integer;
BEGIN
  denied := false;
  BEGIN
    UPDATE public.team_members SET membership_role='owner'
     WHERE id='20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member self-promotion succeeded';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'membership_role update was not denied'; END IF;

  denied := false;
  BEGIN
    UPDATE public.team_members SET team_id='10000000-0000-4000-8000-000000000002'
     WHERE id='20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member moved its team membership';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'team_id update was not denied'; END IF;

  denied := false;
  BEGIN
    UPDATE public.team_members SET user_id='30000000-0000-4000-8000-000000000003'
     WHERE id='20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member changed its authenticated identity';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'user_id update was not denied'; END IF;

  denied := false;
  BEGIN
    UPDATE public.team_members SET status='pending'
     WHERE id='20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member changed membership status';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'status update was not denied'; END IF;

  denied := false;
  BEGIN
    UPDATE public.team_members SET assigned_role='Owner'
     WHERE id='20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member directly changed assigned role';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'assigned_role update was not denied'; END IF;

  denied := false;
  BEGIN
    UPDATE public.team_members SET player_number=4
     WHERE id='20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member directly changed player slot';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'player_number update was not denied'; END IF;

  UPDATE public.team_members
     SET character_loadout='{"active":"test"}'::jsonb
   WHERE id='20000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'own character_loadout update was not preserved'; END IF;

  UPDATE public.team_members
     SET character_loadout='{"active":"same-team-other-user"}'::jsonb
   WHERE id='20000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'member changed another member loadout'; END IF;

  UPDATE public.team_members
     SET character_loadout='{"active":"cross-team"}'::jsonb
   WHERE id='20000000-0000-4000-8000-000000000003';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'member changed another team loadout'; END IF;

  denied := false;
  BEGIN
    PERFORM public.set_member_assignment(
      '20000000-0000-4000-8000-000000000002',3,'Third Rusher',true
    );
    RAISE EXCEPTION 'SECURITY FAILURE: non-owner assignment RPC succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Not allowed' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'non-owner assignment RPC was not denied'; END IF;

  denied := false;
  BEGIN
    PERFORM public.assign_member(
      '20000000-0000-4000-8000-000000000002',3,true
    );
    RAISE EXCEPTION 'SECURITY FAILURE: non-owner assign_member succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Not allowed' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'non-owner assign_member was not denied'; END IF;
END;
$$;
COMMIT;
SQL

# Signed-out RPC invocation is rejected.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '';
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.set_member_assignment(
      '20000000-0000-4000-8000-000000000002',2,'Third Rusher',true
    );
    RAISE EXCEPTION 'SECURITY FAILURE: signed-out assignment RPC succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Not signed in' THEN denied := true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'signed-out assignment RPC was not denied'; END IF;
END;
$$;
COMMIT;
SQL

# Owner-only assignment works; role-only updates preserve the existing slot.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '30000000-0000-4000-8000-000000000001';
SELECT public.set_member_assignment(
  '20000000-0000-4000-8000-000000000002',3,'Third Rusher',true
);
SELECT public.set_member_assignment(
  '20000000-0000-4000-8000-000000000002',NULL,'Coach',true
);
COMMIT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
     WHERE id='20000000-0000-4000-8000-000000000002'
       AND team_id='10000000-0000-4000-8000-000000000001'
       AND user_id='30000000-0000-4000-8000-000000000002'
       AND membership_role='player'
       AND status='active'
       AND player_number=3
       AND assigned_role='Coach'
  ) THEN
    RAISE EXCEPTION 'owner assignment failed or changed protected membership identity';
  END IF;
END;
$$;

echo "Phase One membership ACL PASS: member escalation denied; owner RPC enforced; loadout self-service preserved; cross-team and other-member writes denied."
