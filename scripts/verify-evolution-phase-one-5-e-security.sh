#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to a disposable PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261122110000_team_members_owner_rpc_only.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY, team_id uuid NOT NULL, user_id uuid NOT NULL,
  player_number smallint, assigned_role text, membership_role text NOT NULL,
  status text NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(),
  display_name text, character_loadout jsonb
);
CREATE TABLE public.team_settings (
  team_id uuid NOT NULL, setting_key text NOT NULL, setting_value jsonb,
  PRIMARY KEY(team_id,setting_key)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_team_owner(t uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.team_members
   WHERE team_id=t AND user_id=auth.uid()
     AND status='active' AND membership_role='owner'
) $$;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid) TO authenticated;
CREATE POLICY tm_update_character_loadout ON public.team_members
  FOR UPDATE TO authenticated
  USING (user_id=auth.uid() OR public.is_team_owner(team_id))
  WITH CHECK (user_id=auth.uid() OR public.is_team_owner(team_id));
GRANT SELECT, UPDATE ON public.team_members TO authenticated;
GRANT SELECT ON public.team_settings TO authenticated;

INSERT INTO public.team_members(id,team_id,user_id,membership_role,status) VALUES
 ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','owner','active'),
 ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000020','player','active');
INSERT INTO public.team_settings(team_id,setting_key,setting_value)
VALUES ('00000000-0000-0000-0000-000000000001','roster_capacity','5'::jsonb);
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE c text;
BEGIN
  IF has_table_privilege('authenticated','public.team_members','UPDATE') THEN
    RAISE EXCEPTION 'authenticated still has table-level UPDATE';
  END IF;
  FOREACH c IN ARRAY ARRAY['id','team_id','user_id','player_number','assigned_role','membership_role','status','joined_at','display_name','character_loadout'] LOOP
    IF has_column_privilege('authenticated','public.team_members',c,'UPDATE') THEN
      RAISE EXCEPTION 'authenticated still has UPDATE on column %',c;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname='tm_update_character_loadout') THEN
    RAISE EXCEPTION 'legacy UPDATE policy remains';
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
SELECT public.assign_member_with_role(
 '00000000-0000-0000-0000-000000000020',2,true,'Secondary Rusher'
);
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.team_members
    WHERE id='00000000-0000-0000-0000-000000000020'
      AND player_number=2 AND assigned_role='Secondary Rusher' AND status='active')
  THEN RAISE EXCEPTION 'owner RPC did not update slot and role'; END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
DO $$
BEGIN
  BEGIN
    UPDATE public.team_members SET membership_role='owner'
     WHERE id='00000000-0000-0000-0000-000000000020';
    RAISE EXCEPTION 'direct membership_role UPDATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000020',false);
DO $$
BEGIN
  BEGIN
    PERFORM public.assign_member_with_role(
      '00000000-0000-0000-0000-000000000020',3,true,'Sniper'
    );
    RAISE EXCEPTION 'non-owner RPC call unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='non-owner RPC call unexpectedly succeeded' THEN RAISE; END IF;
    IF SQLERRM<>'Only an active team owner can assign a member' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT membership_role FROM public.team_members
      WHERE id='00000000-0000-0000-0000-000000000020')<>'player'
  THEN RAISE EXCEPTION 'membership_role was altered'; END IF;
  IF (SELECT player_number FROM public.team_members
      WHERE id='00000000-0000-0000-0000-000000000020')<>2
  THEN RAISE EXCEPTION 'non-owner changed player_number'; END IF;
END $$;
SELECT 'team_members owner-RPC-only contract PASS' AS result;
SQL
