-- Evolution Phase Two.7 — Substitution Tracking
-- Additive only: immutable substitution events and lineup snapshots; no historical guesses.

CREATE TABLE IF NOT EXISTS public.canonical_session_substitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  canonical_session_id uuid NOT NULL,
  canonical_session_match_id uuid NOT NULL,
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  outgoing_participant_id uuid NOT NULL,
  outgoing_roster_member_id uuid NOT NULL,
  outgoing_player_user_id uuid NOT NULL,
  incoming_participant_id uuid NOT NULL,
  incoming_roster_member_id uuid NOT NULL,
  incoming_player_user_id uuid NOT NULL,
  effective_at timestamptz NOT NULL,
  reported_effective_at timestamptz NOT NULL,
  effective_round_label text CHECK (effective_round_label IS NULL OR char_length(effective_round_label) <= 80),
  substitution_category text NOT NULL CHECK (substitution_category IN ('tactical','availability','ruleset','other')),
  source_provenance text NOT NULL CHECK (source_provenance IN ('coach_report','official_scorecard','team_record','other')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  role_transfer_requested boolean NOT NULL DEFAULT false,
  lineup_before jsonb NOT NULL CHECK (jsonb_typeof(lineup_before) = 'array'),
  lineup_after jsonb NOT NULL CHECK (jsonb_typeof(lineup_after) = 'array'),
  idempotency_key uuid NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_substitutions_match_team_fk
    FOREIGN KEY (canonical_session_match_id, team_id, canonical_session_id)
    REFERENCES public.canonical_session_matches(id, team_id, canonical_session_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_substitutions_outgoing_participant_fk
    FOREIGN KEY (outgoing_participant_id, team_id)
    REFERENCES public.canonical_session_match_participants(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_substitutions_incoming_participant_fk
    FOREIGN KEY (incoming_participant_id, team_id)
    REFERENCES public.canonical_session_match_participants(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_substitutions_outgoing_roster_fk
    FOREIGN KEY (outgoing_roster_member_id, team_id, canonical_session_id, outgoing_player_user_id)
    REFERENCES public.canonical_session_roster_members(id, team_id, canonical_session_id, player_user_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_substitutions_incoming_roster_fk
    FOREIGN KEY (incoming_roster_member_id, team_id, canonical_session_id, incoming_player_user_id)
    REFERENCES public.canonical_session_roster_members(id, team_id, canonical_session_id, player_user_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_substitutions_distinct_players CHECK (outgoing_player_user_id <> incoming_player_user_id),
  CONSTRAINT canonical_session_substitutions_sequence_unique UNIQUE (canonical_session_match_id, sequence_no),
  CONSTRAINT canonical_session_substitutions_idempotency_unique UNIQUE (canonical_session_match_id, idempotency_key),
  CONSTRAINT canonical_session_substitutions_id_team_unique UNIQUE (id, team_id)
);

CREATE INDEX IF NOT EXISTS canonical_session_substitutions_timeline_idx
  ON public.canonical_session_substitutions(team_id, canonical_session_id, canonical_session_match_id, effective_at, sequence_no);

CREATE TABLE IF NOT EXISTS public.canonical_session_substitution_role_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  substitution_id uuid NOT NULL,
  canonical_session_id uuid NOT NULL,
  canonical_session_match_id uuid NOT NULL,
  outgoing_player_user_id uuid NOT NULL,
  incoming_player_user_id uuid NOT NULL,
  source_role_assignment_id uuid NOT NULL,
  target_role_assignment_id uuid NOT NULL,
  role_definition_id uuid NOT NULL,
  role_key_snapshot text NOT NULL,
  role_name_snapshot text NOT NULL,
  role_definition_version_snapshot integer NOT NULL,
  role_change_event_id uuid NOT NULL REFERENCES public.canonical_session_match_role_events(id) ON DELETE RESTRICT,
  effective_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  idempotency_key uuid NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT canonical_session_substitution_role_transfer_substitution_fk
    FOREIGN KEY (substitution_id, team_id) REFERENCES public.canonical_session_substitutions(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_substitution_role_transfer_source_fk
    FOREIGN KEY (source_role_assignment_id, team_id) REFERENCES public.canonical_session_match_roles(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_substitution_role_transfer_target_fk
    FOREIGN KEY (target_role_assignment_id, team_id) REFERENCES public.canonical_session_match_roles(id, team_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_substitution_role_transfer_match_fk
    FOREIGN KEY (canonical_session_match_id, team_id, canonical_session_id)
    REFERENCES public.canonical_session_matches(id, team_id, canonical_session_id) ON DELETE RESTRICT,
  CONSTRAINT canonical_session_substitution_role_transfer_idempotency_unique UNIQUE (substitution_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS canonical_session_substitution_role_transfers_match_idx
  ON public.canonical_session_substitution_role_transfers(team_id, canonical_session_match_id, effective_at);

ALTER TABLE public.canonical_session_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_session_substitution_role_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS canonical_session_substitutions_staff_read ON public.canonical_session_substitutions;
CREATE POLICY canonical_session_substitutions_staff_read ON public.canonical_session_substitutions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_substitutions.team_id
      AND actor.user_id = auth.uid() AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));

DROP POLICY IF EXISTS canonical_session_substitution_role_transfers_staff_read ON public.canonical_session_substitution_role_transfers;
CREATE POLICY canonical_session_substitution_role_transfers_staff_read ON public.canonical_session_substitution_role_transfers
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = canonical_session_substitution_role_transfers.team_id
      AND actor.user_id = auth.uid() AND actor.status = 'active'
      AND actor.membership_role IN ('owner','coach')
  ));

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_substitution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND pg_catalog.current_setting('app.evolution_substitution_action', true) = 'record' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_session_substitution_is_append_only_rpc_required' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION evolution_private.guard_canonical_session_substitution_role_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND pg_catalog.current_setting('app.evolution_substitution_role_transfer_action', true) = 'record' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'canonical_session_substitution_role_transfer_is_append_only_rpc_required' USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION evolution_private.guard_canonical_session_substitution() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION evolution_private.guard_canonical_session_substitution_role_transfer() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS canonical_session_substitution_guard ON public.canonical_session_substitutions;
CREATE TRIGGER canonical_session_substitution_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.canonical_session_substitutions FOR EACH ROW
  EXECUTE FUNCTION evolution_private.guard_canonical_session_substitution();

DROP TRIGGER IF EXISTS canonical_session_substitution_role_transfer_guard ON public.canonical_session_substitution_role_transfers;
CREATE TRIGGER canonical_session_substitution_role_transfer_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.canonical_session_substitution_role_transfers FOR EACH ROW
  EXECUTE FUNCTION evolution_private.guard_canonical_session_substitution_role_transfer();

REVOKE INSERT, UPDATE, DELETE ON public.canonical_session_substitutions,
  public.canonical_session_substitution_role_transfers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.canonical_session_substitutions,
  public.canonical_session_substitution_role_transfers TO authenticated;

CREATE OR REPLACE FUNCTION public.record_canonical_session_substitution(
  p_match_id uuid,
  p_outgoing_roster_member_id uuid,
  p_incoming_roster_member_id uuid,
  p_effective_at timestamptz,
  p_effective_round_label text,
  p_category text,
  p_source_provenance text,
  p_reason text,
  p_transfer_role boolean,
  p_idempotency_key uuid
)
RETURNS public.canonical_session_substitutions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_match public.canonical_session_matches;
  v_session public.canonical_sessions;
  v_outgoing public.canonical_session_match_participants;
  v_incoming public.canonical_session_match_participants;
  v_outgoing_member public.canonical_session_roster_members;
  v_incoming_member public.canonical_session_roster_members;
  v_existing public.canonical_session_substitutions;
  v_substitution public.canonical_session_substitutions;
  v_outgoing_role public.canonical_session_match_roles;
  v_incoming_role public.canonical_session_match_roles;
  v_role_definition public.canonical_team_role_definitions;
  v_role_event public.canonical_session_match_role_events;
  v_role_transfer public.canonical_session_substitution_role_transfers;
  v_lineup_before jsonb;
  v_lineup_after jsonb;
  v_sequence integer;
  v_effective_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  IF p_idempotency_key IS NULL OR p_effective_at IS NULL OR p_effective_at > clock_timestamp()
    OR p_category IS NULL OR p_category NOT IN ('tactical','availability','ruleset','other')
    OR p_source_provenance IS NULL OR p_source_provenance NOT IN ('coach_report','official_scorecard','team_record','other')
    OR p_reason IS NULL OR char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500
    OR (p_effective_round_label IS NOT NULL AND char_length(p_effective_round_label) > 80)
    OR p_transfer_role IS NULL
  THEN RAISE EXCEPTION 'canonical_session_substitution_arguments_invalid' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_match FROM public.canonical_session_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_match_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = v_match.canonical_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = v_match.team_id AND actor.user_id = auth.uid()
      AND actor.status = 'active' AND actor.membership_role IN ('owner','coach'))
  THEN RAISE EXCEPTION 'active_owner_or_coach_required' USING ERRCODE = '42501'; END IF;

  PERFORM 1 FROM public.canonical_sessions WHERE id = v_session.id FOR UPDATE;
  PERFORM 1 FROM public.canonical_session_matches WHERE id = v_match.id FOR UPDATE;
  SELECT * INTO v_session FROM public.canonical_sessions WHERE id = v_session.id;
  IF v_session.archived_at IS NOT NULL OR v_session.lifecycle_status NOT IN ('in_progress','awaiting_results')
  THEN RAISE EXCEPTION 'canonical_session_substitution_requires_active_session' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_existing FROM public.canonical_session_substitutions
  WHERE canonical_session_match_id = v_match.id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.outgoing_roster_member_id <> p_outgoing_roster_member_id
      OR v_existing.incoming_roster_member_id <> p_incoming_roster_member_id
      OR v_existing.reported_effective_at <> p_effective_at
      OR v_existing.effective_round_label IS DISTINCT FROM p_effective_round_label
      OR v_existing.substitution_category <> p_category
      OR v_existing.source_provenance <> p_source_provenance
      OR v_existing.reason <> pg_catalog.btrim(p_reason)
      OR v_existing.role_transfer_requested <> p_transfer_role
    THEN RAISE EXCEPTION 'canonical_session_substitution_idempotency_conflict' USING ERRCODE = '22023'; END IF;
    RETURN v_existing;
  END IF;

  SELECT * INTO v_outgoing_member FROM public.canonical_session_roster_members
  WHERE id = p_outgoing_roster_member_id AND team_id = v_match.team_id
    AND canonical_session_id = v_match.canonical_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_substitution_outgoing_roster_invalid' USING ERRCODE = '23503'; END IF;
  SELECT * INTO v_incoming_member FROM public.canonical_session_roster_members
  WHERE id = p_incoming_roster_member_id AND team_id = v_match.team_id
    AND canonical_session_id = v_match.canonical_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_substitution_incoming_roster_invalid' USING ERRCODE = '23503'; END IF;
  IF v_outgoing_member.player_user_id = v_incoming_member.player_user_id
  THEN RAISE EXCEPTION 'canonical_session_substitution_players_must_differ' USING ERRCODE = '22023'; END IF;
  IF v_outgoing_member.selection_status NOT IN ('selected','confirmed')
    OR v_incoming_member.selection_status NOT IN ('selected','confirmed')
  THEN RAISE EXCEPTION 'canonical_session_substitution_requires_selected_roster_members' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_outgoing FROM public.canonical_session_match_participants
  WHERE canonical_session_match_id = v_match.id AND roster_member_id = v_outgoing_member.id FOR UPDATE;
  IF NOT FOUND OR v_outgoing.participation_status <> 'participated'
  THEN RAISE EXCEPTION 'canonical_session_substitution_outgoing_must_be_active' USING ERRCODE = '23514'; END IF;

  SELECT * INTO v_incoming FROM public.canonical_session_match_participants
  WHERE canonical_session_match_id = v_match.id AND roster_member_id = v_incoming_member.id FOR UPDATE;
  IF FOUND AND v_incoming.participation_status = 'participated'
  THEN RAISE EXCEPTION 'canonical_session_substitution_incoming_already_active' USING ERRCODE = '23514'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.canonical_session_lifecycle_events
    WHERE canonical_session_id = v_session.id AND new_status = 'in_progress' AND changed_at <= p_effective_at)
  THEN RAISE EXCEPTION 'canonical_session_substitution_effective_time_outside_session' USING ERRCODE = '23514'; END IF;
  IF p_effective_at < coalesce((SELECT max(effective_at) FROM public.canonical_session_substitutions
    WHERE canonical_session_match_id = v_match.id), p_effective_at)
  THEN RAISE EXCEPTION 'canonical_session_substitution_effective_time_out_of_order' USING ERRCODE = '23514'; END IF;
  IF v_outgoing.recorded_at > p_effective_at
  THEN RAISE EXCEPTION 'canonical_session_substitution_precedes_outgoing_participation' USING ERRCODE = '23514'; END IF;

  v_lineup_before := coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'roster_member_id',p.roster_member_id,'player_user_id',p.player_user_id,
      'display_name',rm.display_name_snapshot,'player_number',rm.player_number_snapshot,
      'role_definition_id',mr.role_definition_id,'role_key',mr.role_key_snapshot,
      'role_name',mr.role_name_snapshot,'role_version',mr.role_definition_version_snapshot,
      'role_status',mr.role_assignment_status
    ) ORDER BY rm.player_number_snapshot NULLS LAST,p.player_user_id)
    FROM public.canonical_session_match_participants p
    JOIN public.canonical_session_roster_members rm ON rm.id = p.roster_member_id
    LEFT JOIN public.canonical_session_match_roles mr
      ON mr.canonical_session_match_id = p.canonical_session_match_id AND mr.roster_member_id = p.roster_member_id
    WHERE p.canonical_session_match_id = v_match.id AND p.participation_status = 'participated'
  ), '[]'::jsonb);

  PERFORM public.correct_canonical_match_participation(
    v_outgoing.id,'substituted','Substituted out: ' || pg_catalog.btrim(p_reason),
    md5(p_idempotency_key::text || ':outgoing')::uuid
  );

  IF v_incoming.id IS NULL THEN
    v_incoming := public.record_canonical_match_participation(
      v_match.id,v_incoming_member.id,'participated','Substituted in: ' || pg_catalog.btrim(p_reason),
      md5(p_idempotency_key::text || ':incoming')::uuid
    );
  ELSE
    PERFORM public.correct_canonical_match_participation(
      v_incoming.id,'participated','Substituted in: ' || pg_catalog.btrim(p_reason),
      md5(p_idempotency_key::text || ':incoming')::uuid
    );
    SELECT * INTO v_incoming FROM public.canonical_session_match_participants WHERE id = v_incoming.id;
  END IF;

  v_effective_at := p_effective_at;
  IF p_transfer_role THEN
    SELECT * INTO v_outgoing_role FROM public.canonical_session_match_roles
    WHERE canonical_session_match_id = v_match.id AND roster_member_id = v_outgoing_member.id;
    SELECT * INTO v_incoming_role FROM public.canonical_session_match_roles
    WHERE canonical_session_match_id = v_match.id AND roster_member_id = v_incoming_member.id;
    IF v_outgoing_role.id IS NULL OR v_incoming_role.id IS NULL
      OR v_outgoing_role.role_assignment_status <> 'assigned' OR v_outgoing_role.role_definition_id IS NULL
    THEN RAISE EXCEPTION 'canonical_session_substitution_role_transfer_source_unassigned' USING ERRCODE = '23514'; END IF;

    SELECT * INTO v_role_definition FROM public.canonical_team_role_definitions
    WHERE id = v_outgoing_role.role_definition_id AND team_id = v_match.team_id AND is_current AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'canonical_session_substitution_role_transfer_requires_current_active_definition' USING ERRCODE = '23514'; END IF;

    v_effective_at := greatest(p_effective_at,v_incoming_role.effective_at);
    v_role_event := public.set_canonical_session_match_role(
      v_match.id,v_incoming_member.id,v_role_definition.id,v_effective_at,p_effective_round_label,
      'Role transferred with substitution: ' || pg_catalog.btrim(p_reason),
      md5(p_idempotency_key::text || ':role-transfer')::uuid
    );
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'roster_member_id',p.roster_member_id,'player_user_id',p.player_user_id,
    'display_name',rm.display_name_snapshot,'player_number',rm.player_number_snapshot,
    'role_definition_id',mr.role_definition_id,'role_key',mr.role_key_snapshot,
    'role_name',mr.role_name_snapshot,'role_version',mr.role_definition_version_snapshot,
    'role_status',mr.role_assignment_status
  ) ORDER BY rm.player_number_snapshot NULLS LAST,p.player_user_id),'[]'::jsonb)
  INTO v_lineup_after
  FROM public.canonical_session_match_participants p
  JOIN public.canonical_session_roster_members rm ON rm.id = p.roster_member_id
  LEFT JOIN public.canonical_session_match_roles mr
    ON mr.canonical_session_match_id = p.canonical_session_match_id AND mr.roster_member_id = p.roster_member_id
  WHERE p.canonical_session_match_id = v_match.id AND p.participation_status = 'participated';

  SELECT coalesce(max(sequence_no),0) + 1 INTO v_sequence
  FROM public.canonical_session_substitutions WHERE canonical_session_match_id = v_match.id;

  PERFORM pg_catalog.set_config('app.evolution_substitution_action','record',true);
  INSERT INTO public.canonical_session_substitutions(
    team_id,canonical_session_id,canonical_session_match_id,sequence_no,
    outgoing_participant_id,outgoing_roster_member_id,outgoing_player_user_id,
    incoming_participant_id,incoming_roster_member_id,incoming_player_user_id,
    effective_at,reported_effective_at,effective_round_label,substitution_category,source_provenance,
    reason,role_transfer_requested,lineup_before,lineup_after,idempotency_key,changed_by
  ) VALUES (
    v_match.team_id,v_match.canonical_session_id,v_match.id,v_sequence,
    v_outgoing.id,v_outgoing_member.id,v_outgoing_member.player_user_id,
    v_incoming.id,v_incoming_member.id,v_incoming_member.player_user_id,
    v_effective_at,p_effective_at,p_effective_round_label,p_category,p_source_provenance,
    pg_catalog.btrim(p_reason),p_transfer_role,v_lineup_before,v_lineup_after,p_idempotency_key,auth.uid()
  ) RETURNING * INTO v_substitution;

  IF p_transfer_role THEN
    PERFORM pg_catalog.set_config('app.evolution_substitution_role_transfer_action','record',true);
    INSERT INTO public.canonical_session_substitution_role_transfers(
      team_id,substitution_id,canonical_session_id,canonical_session_match_id,
      outgoing_player_user_id,incoming_player_user_id,source_role_assignment_id,target_role_assignment_id,
      role_definition_id,role_key_snapshot,role_name_snapshot,role_definition_version_snapshot,
      role_change_event_id,effective_at,reason,idempotency_key,changed_by
    ) VALUES (
      v_match.team_id,v_substitution.id,v_match.canonical_session_id,v_match.id,
      v_outgoing_member.player_user_id,v_incoming_member.player_user_id,v_outgoing_role.id,v_incoming_role.id,
      v_role_definition.id,v_role_definition.role_key,v_role_definition.role_name,v_role_definition.definition_version,
      v_role_event.id,v_role_event.effective_at,
      'Role transfer recorded separately from player replacement: ' || pg_catalog.btrim(p_reason),
      md5(p_idempotency_key::text || ':role-transfer-audit')::uuid,auth.uid()
    ) RETURNING * INTO v_role_transfer;
  END IF;
  RETURN v_substitution;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_canonical_session_match_lineup(
  p_match_id uuid,
  p_as_of timestamptz DEFAULT clock_timestamp()
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_team_id uuid;
  v_lineup jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000'; END IF;
  SELECT team_id INTO v_team_id FROM public.canonical_session_matches WHERE id = p_match_id;
  IF v_team_id IS NULL THEN RAISE EXCEPTION 'canonical_match_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members actor
    WHERE actor.team_id = v_team_id AND actor.user_id = auth.uid() AND actor.status = 'active')
  THEN RAISE EXCEPTION 'active_team_membership_required' USING ERRCODE = '42501'; END IF;
  IF p_as_of IS NULL THEN RAISE EXCEPTION 'lineup_as_of_required' USING ERRCODE = '22023'; END IF;

  SELECT CASE WHEN prior_event.id IS NOT NULL THEN prior_event.lineup_after
              WHEN first_event.id IS NOT NULL THEN first_event.lineup_before ELSE NULL END
  INTO v_lineup
  FROM (SELECT 1) seed
  LEFT JOIN LATERAL (
    SELECT * FROM public.canonical_session_substitutions s
    WHERE s.canonical_session_match_id = p_match_id AND s.effective_at <= p_as_of
    ORDER BY s.effective_at DESC,s.sequence_no DESC LIMIT 1
  ) prior_event ON true
  LEFT JOIN LATERAL (
    SELECT * FROM public.canonical_session_substitutions s
    WHERE s.canonical_session_match_id = p_match_id
    ORDER BY s.effective_at,s.sequence_no LIMIT 1
  ) first_event ON true;
  IF v_lineup IS NOT NULL THEN RETURN v_lineup; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'roster_member_id',p.roster_member_id,'player_user_id',p.player_user_id,
    'display_name',rm.display_name_snapshot,'player_number',rm.player_number_snapshot,
    'role_definition_id',mr.role_definition_id,'role_key',mr.role_key_snapshot,
    'role_name',mr.role_name_snapshot,'role_version',mr.role_definition_version_snapshot,
    'role_status',mr.role_assignment_status
  ) ORDER BY rm.player_number_snapshot NULLS LAST,p.player_user_id),'[]'::jsonb)
  INTO v_lineup
  FROM public.canonical_session_match_participants p
  JOIN public.canonical_session_roster_members rm ON rm.id = p.roster_member_id
  LEFT JOIN public.canonical_session_match_roles mr
    ON mr.canonical_session_match_id = p.canonical_session_match_id AND mr.roster_member_id = p.roster_member_id
  WHERE p.canonical_session_match_id = p_match_id AND p.participation_status = 'participated';
  RETURN v_lineup;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_canonical_session_substitution(uuid,uuid,uuid,timestamptz,text,text,text,text,boolean,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_canonical_session_match_lineup(uuid,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_canonical_session_substitution(uuid,uuid,uuid,timestamptz,text,text,text,text,boolean,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_canonical_session_match_lineup(uuid,timestamptz) TO authenticated;

COMMENT ON TABLE public.canonical_session_substitutions IS
  'Append-only ordered match substitution timeline with outgoing/incoming identities, effective context, provenance and immutable before/after lineups.';
COMMENT ON TABLE public.canonical_session_substitution_role_transfers IS
  'Separate append-only record of a role transfer performed as part of a substitution; player replacement and role assignment are distinct audited facts.';
COMMENT ON FUNCTION public.get_canonical_session_match_lineup(uuid,timestamptz) IS
  'Reconstructs the active lineup at a supported timestamp from immutable substitution snapshots.';
