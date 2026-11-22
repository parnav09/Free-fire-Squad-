-- Evolution Phase 3.4 — Evidence provenance and verification workflow.
-- Additive only. Existing evidence identity/content remains immutable.
-- Status changes are represented by an append-only event ledger; current state
-- is derived from the latest event rather than mutating Phase 3.3 evidence rows.

CREATE TABLE IF NOT EXISTS public.evolution_evidence_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  evidence_item_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL CHECK (
    to_status IN ('pending', 'verified', 'rejected', 'corrected', 'archived')
  ),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text,
  evidence_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evolution_evidence_verification_item_team_fk
    FOREIGN KEY (evidence_item_id, team_id)
    REFERENCES public.evolution_evidence_items(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT evolution_evidence_verification_version_fk
    FOREIGN KEY (evidence_version_id, evidence_item_id, team_id)
    REFERENCES public.evolution_evidence_versions(id, evidence_item_id, team_id)
    ON DELETE RESTRICT,
  CONSTRAINT evolution_evidence_verification_reason_required CHECK (
    to_status NOT IN ('rejected', 'corrected', 'archived')
    OR char_length(btrim(COALESCE(reason, ''))) BETWEEN 3 AND 1000
  ),
  CONSTRAINT evolution_evidence_verification_transition_valid CHECK (
    (from_status IS NULL AND to_status = 'pending')
    OR (from_status = 'pending' AND to_status IN ('verified','rejected','corrected','archived'))
    OR (from_status = 'verified' AND to_status IN ('corrected','archived'))
    OR (from_status = 'rejected' AND to_status IN ('corrected','archived'))
    OR (from_status = 'corrected' AND to_status IN ('pending','verified','rejected','archived'))
  )
);

CREATE INDEX IF NOT EXISTS evolution_evidence_verification_timeline_idx
  ON public.evolution_evidence_verification_events(team_id, evidence_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS evolution_evidence_verification_actor_idx
  ON public.evolution_evidence_verification_events(team_id, actor_user_id, created_at DESC);

-- Backfill only the initial pending event for pre-existing Phase 3.3 evidence.
-- This records provenance without rewriting the evidence item or its content.
INSERT INTO public.evolution_evidence_verification_events(
  team_id, evidence_item_id, from_status, to_status, actor_user_id, reason
)
SELECT e.team_id, e.id, NULL, 'pending', e.created_by, 'Initial state recorded from immutable evidence creation'
FROM public.evolution_evidence_items e
WHERE NOT EXISTS (
  SELECT 1 FROM public.evolution_evidence_verification_events v
  WHERE v.evidence_item_id = e.id
);

CREATE OR REPLACE FUNCTION evolution_private.guard_evolution_evidence_verification_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  latest_status text;
  latest_version_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Evidence verification history is append-only'
      USING ERRCODE = '55000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.evidence_item_id::text, 0));

  SELECT v.to_status, v.evidence_version_id
    INTO latest_status, latest_version_id
  FROM public.evolution_evidence_verification_events v
  WHERE v.evidence_item_id = NEW.evidence_item_id
  ORDER BY v.created_at DESC, v.id DESC
  LIMIT 1;

  IF latest_status IS NULL THEN
    IF NEW.from_status IS NOT NULL OR NEW.to_status <> 'pending' THEN
      RAISE EXCEPTION 'First evidence event must establish pending state'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.from_status IS DISTINCT FROM latest_status THEN
    RAISE EXCEPTION 'Evidence status conflict; expected current state %', latest_status
      USING ERRCODE = '40001';
  END IF;

  IF NEW.to_status = 'corrected' THEN
    IF NEW.evidence_version_id IS NULL
      OR NEW.evidence_version_id IS NOT DISTINCT FROM latest_version_id THEN
      RAISE EXCEPTION 'Correction must reference a newly appended evidence version'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.evidence_version_id IS NOT NULL
    AND NEW.evidence_version_id IS NOT DISTINCT FROM latest_version_id THEN
    RAISE EXCEPTION 'Verification event must not repeat the previous evidence version'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION evolution_private.guard_evolution_evidence_verification_event()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS evolution_evidence_verification_append_only
  ON public.evolution_evidence_verification_events;
CREATE TRIGGER evolution_evidence_verification_append_only
BEFORE INSERT OR UPDATE OR DELETE
ON public.evolution_evidence_verification_events
FOR EACH ROW EXECUTE FUNCTION evolution_private.guard_evolution_evidence_verification_event();

ALTER TABLE public.evolution_evidence_verification_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.evolution_evidence_verification_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.evolution_evidence_verification_events TO authenticated;

DROP POLICY IF EXISTS evolution_evidence_verification_visibility_read
  ON public.evolution_evidence_verification_events;
CREATE POLICY evolution_evidence_verification_visibility_read
ON public.evolution_evidence_verification_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.evolution_evidence_items e
  WHERE e.id = evolution_evidence_verification_events.evidence_item_id
    AND e.team_id = evolution_evidence_verification_events.team_id
));

-- One authoritative status resolver. It is safe for a caller to query only
-- evidence already visible through Phase 3.3 RLS.
CREATE OR REPLACE VIEW public.evolution_evidence_current_status
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (v.evidence_item_id)
  v.team_id, v.evidence_item_id, v.to_status AS status,
  v.actor_user_id AS last_actor_user_id, v.created_at AS status_changed_at,
  v.reason, v.evidence_version_id
FROM public.evolution_evidence_verification_events v
ORDER BY v.evidence_item_id, v.created_at DESC, v.id DESC;

GRANT SELECT ON public.evolution_evidence_current_status TO authenticated;

-- Verification is coach/owner-only and must be performed by someone other
-- than the evidence author. The RPC rechecks membership and state server-side.
CREATE OR REPLACE FUNCTION public.transition_evolution_evidence_status(
  p_evidence_item_id uuid,
  p_to_status text,
  p_reason text DEFAULT NULL,
  p_evidence_version_id uuid DEFAULT NULL
)
RETURNS public.evolution_evidence_verification_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_evidence public.evolution_evidence_items%ROWTYPE;
  v_current_status text;
  v_actor uuid := auth.uid();
  v_event public.evolution_evidence_verification_events%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_to_status NOT IN ('verified','rejected','corrected','archived','pending') THEN
    RAISE EXCEPTION 'Unsupported evidence status' USING ERRCODE = '22023';
  END IF;

  SELECT e.* INTO v_evidence
  FROM public.evolution_evidence_items e
  WHERE e.id = p_evidence_item_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evidence not found or not accessible' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = v_evidence.team_id AND tm.user_id = v_actor
      AND tm.status = 'active' AND tm.membership_role IN ('owner','coach')
  ) THEN
    RAISE EXCEPTION 'Only active team owners/coaches may manage evidence verification'
      USING ERRCODE = '42501';
  END IF;

  IF v_actor = v_evidence.created_by THEN
    RAISE EXCEPTION 'Evidence author cannot verify or adjudicate their own evidence'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.status INTO v_current_status
  FROM public.evolution_evidence_current_status s
  WHERE s.evidence_item_id = p_evidence_item_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Evidence status history is missing' USING ERRCODE = '55000';
  END IF;

  IF p_to_status = 'corrected' THEN
    IF p_evidence_version_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.evolution_evidence_versions ver
      WHERE ver.id = p_evidence_version_id
        AND ver.evidence_item_id = p_evidence_item_id
        AND ver.team_id = v_evidence.team_id
    ) THEN
      RAISE EXCEPTION 'Correction must reference a version belonging to this evidence'
        USING ERRCODE = '23503';
    END IF;
  ELSIF p_evidence_version_id IS NOT NULL THEN
    RAISE EXCEPTION 'A version reference is accepted only for corrected status'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.evolution_evidence_verification_events(
    team_id, evidence_item_id, from_status, to_status,
    actor_user_id, reason, evidence_version_id
  ) VALUES (
    v_evidence.team_id, v_evidence.id, v_current_status, p_to_status,
    v_actor, NULLIF(btrim(p_reason), ''), p_evidence_version_id
  ) RETURNING * INTO v_event;

  RETURN v_event;
END;
$function$;
REVOKE ALL ON FUNCTION public.transition_evolution_evidence_status(uuid,text,text,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_evolution_evidence_status(uuid,text,text,uuid)
  TO authenticated;

-- Duplicate candidates are advisory only. No record is merged or hidden.
CREATE OR REPLACE FUNCTION public.find_evolution_evidence_duplicate_candidates(
  p_evidence_item_id uuid
)
RETURNS TABLE(candidate_evidence_id uuid, match_reason text, candidate_created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT other.id,
    CASE
      WHEN current.source_locator IS NOT NULL
       AND lower(current.source_locator) = lower(other.source_locator)
        THEN 'same_source_locator'
      ELSE 'same_context_source_and_title'
    END,
    other.created_at
  FROM public.evolution_evidence_items current
  JOIN public.evolution_evidence_items other
    ON other.team_id = current.team_id
   AND other.id <> current.id
   AND other.evaluation_context_id = current.evaluation_context_id
   AND other.source_type = current.source_type
  WHERE current.id = p_evidence_item_id
    AND (
      (current.source_locator IS NOT NULL
        AND lower(current.source_locator) = lower(other.source_locator))
      OR lower(regexp_replace(btrim(current.title), '\s+', ' ', 'g'))
        = lower(regexp_replace(btrim(other.title), '\s+', ' ', 'g'))
    )
  ORDER BY other.created_at DESC
  LIMIT 20;
$function$;
GRANT EXECUTE ON FUNCTION public.find_evolution_evidence_duplicate_candidates(uuid)
  TO authenticated;

COMMENT ON TABLE public.evolution_evidence_verification_events IS
  'Append-only provenance and adjudication history. Current status is the latest event; corrections reference a newly appended evidence version.';
COMMENT ON VIEW public.evolution_evidence_current_status IS
  'Current evidence status derived from immutable verification events; does not mutate Phase 3.3 evidence identity.';
