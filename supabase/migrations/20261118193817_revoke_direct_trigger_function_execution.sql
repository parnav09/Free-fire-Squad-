-- Phase 1.5-E security remediation: trigger-only functions are not RPCs.
-- Revoke direct API execution while preserving invocation by installed triggers.
-- CI verifies all three API roles lose EXECUTE and the Daily Evaluation trigger
-- continues to execute normally.

REVOKE EXECUTE ON FUNCTION public.lock_daily_score_date_and_anonymize()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.log_practice_task_lifecycle()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_practice_task_lifecycle_fields()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.track_practice_task_lifecycle()
  FROM PUBLIC, anon, authenticated, service_role;
