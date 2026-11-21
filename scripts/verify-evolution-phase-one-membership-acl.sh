#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to the disposable CI PostgreSQL service}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122020000_phase_one_secure_team_member_updates.sql"

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

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata'
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  player_number smallint,
  assigned_role text,
  membership_role text NOT NULL CHECK (membership_role IN ('owner','coach','player')),
  status text NOT NULL CHECK (status IN ('pending','active')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  character_loadout jsonb
);

CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.team_members AS tm
     WHERE tm.team_id = p_team_id
       AND tm.user_id = auth.uid()
       AND tm.membership_role = 'owner'
       AND tm.status = 'active'
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
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT tm.team_id INTO v_team_id
    FROM public.team_members AS tm
   WHERE tm.id = p_member;

  IF v_team_id IS NULL OR NOT public.is_team_owner(v_team_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.team_members
     SET player_number = p_player,
         status = CASE WHEN p_activate THEN 'active' ELSE status END
   WHERE id = p_member;
END;
$function$;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tm_update_character_loadout ON public.team_members;
CREATE POLICY tm_update_character_loadout
  ON public.team_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_team_owner(team_id))
  WITH CHECK (user_id = auth.uid() OR public.is_team_owner(team_id));

GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_member(uuid,smallint,boolean) TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.team_members TO authenticated;

INSERT INTO public.teams (id, timezone)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Asia/Kolkata'),
  ('10000000-0000-4000-8000-000000000002', 'Asia/Kolkata')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_members
  (id, team_id, user_id, display_name, player_number, assigned_role, membership_role, status)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Owner', 1, 'Primary Rusher', 'owner', 'active'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Member', 2, 'Secondary Rusher', 'player', 'active'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Other Team', 1, 'Primary Rusher', 'player', 'active')
ON CONFLICT (id) DO NOTHING;
SQL

# Apply the exact Phase One security migration to the disposable PostgreSQL database.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

# Verify least-privilege column grants and the SECURITY DEFINER execution boundary.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  fn oid := 'public.set_member_assignment(uuid,smallint,text,boolean)'::regprocedure;
  cfg text;
BEGIN
  IF has_table_privilege('authenticated', 'public.team_members', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated still has table-level UPDATE on team_members';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.team_members', 'character_loadout', 'UPDATE') THEN
    RAISE EXCEPTION 'character_loadout update permission was not preserved';
  END IF;
  IF has_column_privilege('authenticated', 'public.team_members', 'membership_role', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.team_members', 'team_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.team_members', 'user_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.team_members', 'status', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.team_members', 'assigned_role', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.team_members', 'player_number', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.team_members', 'display_name', 'UPDATE') THEN
    RAISE EXCEPTION 'a protected team_members column remains directly updateable';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = fn) THEN
    RAISE EXCEPTION 'assignment RPC is not SECURITY DEFINER';
  END IF;
  SELECT array_to_string(proconfig, ',') INTO cfg FROM pg_proc WHERE oid = fn;
  IF cfg NOT LIKE '%search_path=pg_catalog, public%' THEN
    RAISE EXCEPTION 'assignment RPC does not pin a safe search_path: %', cfg;
  END IF;
  IF has_function_privilege('anon', fn, 'EXECUTE')
     OR has_function_privilege('public', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon/PUBLIC can execute the owner assignment RPC';
  END IF;
  IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute the owner assignment RPC';
  END IF;
END;
$$;
SQL

# A normal member cannot promote itself, move its membership to another team,
# change its identity/status, or assign itself a roster role.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '30000000-0000-4000-8000-000000000002';
DO $$
DECLARE
  affected integer;
  denied boolean;
BEGIN
  denied := false;
  BEGIN
    UPDATE public.team_members SET membership_role = 'owner'
     WHERE id = '20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member self-promotion succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'membership_role update was not denied'; END IF;

  denied := false;
  BEGIN
    UPDATE public.team_members SET team_id = '10000000-0000-4000-8000-000000000002'
     WHERE id = '20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member moved its membership across teams';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'team_id update was not denied'; END IF;

  denied := false;
  BEGIN
    UPDATE public.team_members SET user_id = '30000000-0000-4000-8000-000000000003'
     WHERE id = '20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member changed membership identity';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'user_id update was not denied'; END IF;

  denied := false;
  BEGIN
    UPDATE public.team_members SET status = 'pending'
     WHERE id = '20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member changed membership status';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'status update was not denied'; END IF;

  denied := false;
  BEGIN
    UPDATE public.team_members SET assigned_role = 'Owner'
     WHERE id = '20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'SECURITY FAILURE: member directly changed assigned role';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'assigned_role update was not denied'; END IF;

  UPDATE public.team_members
     SET character_loadout = '{"active":"test"}'::jsonb
   WHERE id = '20000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'self character_loadout update was not preserved'; END IF;

  UPDATE public.team_members
     SET character_loadout = '{"active":"cross-team"}'::jsonb
   WHERE id = '20000000-0000-4000-8000-000000000003';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'cross-team character_loadout update bypassed RLS'; END IF;

  denied := false;
  BEGIN
    PERFORM public.set_member_assignment(
      '20000000-0000-4000-8000-000000000002', 3, 'Third Rusher', true
    );
    RAISE EXCEPTION 'SECURITY FAILURE: non-owner assignment RPC succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Not allowed' THEN
      denied := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'non-owner assignment RPC was not denied'; END IF;
END;
$$;
COMMIT;
SQL

# A real owner can still assign a member, but only through the owner-checked RPC.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '30000000-0000-4000-8000-000000000001';
SELECT public.set_member_assignment(
  '20000000-0000-4000-8000-000000000002', 2, 'Secondary Rusher', true
);
COMMIT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
     WHERE id = '20000000-0000-4000-8000-000000000002'
       AND player_number = 2
       AND assigned_role = 'Secondary Rusher'
       AND membership_role = 'player'
       AND team_id = '10000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'authorized owner assignment did not preserve the member permission boundary';
  END IF;
END;
$$;
SQL

echo "Phase One membership ACL PASS: direct role/team/identity edits denied; self loadout preserved; cross-team RLS denied; owner assignment RPC enforced."
