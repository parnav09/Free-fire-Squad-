-- Security disposition for trigger-only lifecycle functions flagged by Supabase.
-- STAGED ONLY: validate on isolated PostgreSQL/Supabase-compatible CI before
-- moving into supabase/migrations. Do not apply directly to production.
--
-- These functions are invoked by table triggers, not as PostgREST RPCs.
-- PostgreSQL checks EXECUTE when CREATE TRIGGER is performed; subsequent
-- trigger execution does not require callers to hold EXECUTE on the function.
-- Revoke direct API execution while preserving the already-installed triggers.

REVOKE EXECUTE ON FUNCTION public.lock_daily_score_date_and_anonymize()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_practice_task_lifecycle()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.set_practice_task_lifecycle_fields()
  FROM PUBLIC, anon, authenticated, service_role;

-- Legacy duplicate trigger-returning function has no attached trigger in the
-- live catalog and is not a supported RPC. Keep it non-callable by API roles.
REVOKE EXECUTE ON FUNCTION public.track_practice_task_lifecycle()
  FROM PUBLIC, anon, authenticated, service_role;
