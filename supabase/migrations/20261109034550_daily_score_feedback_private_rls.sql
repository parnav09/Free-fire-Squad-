update public.daily_scores set notes=null, improvement_target=null, improvement_notes=null, mistake_notes=null;
alter table public.daily_scores drop constraint if exists daily_scores_improvement_notes_len;
alter table public.daily_scores drop constraint if exists daily_scores_mistake_notes_len;
alter table public.daily_scores drop column if exists improvement_notes;
alter table public.daily_scores drop column if exists mistake_notes;
create table if not exists public.daily_score_feedback (
 id uuid primary key default gen_random_uuid(),
 score_id uuid not null unique references public.daily_scores(id) on delete cascade,
 team_id uuid not null references public.teams(id) on delete cascade,
 player_id uuid not null,
 improvement_target text, improvement_notes text, mistake_notes text, context_notes text,
 created_at timestamptz not null default now(),
 constraint daily_score_feedback_target_len check(improvement_target is null or char_length(improvement_target)<=500),
 constraint daily_score_feedback_improvement_len check(improvement_notes is null or char_length(improvement_notes)<=10000),
 constraint daily_score_feedback_mistake_len check(mistake_notes is null or char_length(mistake_notes)<=10000),
 constraint daily_score_feedback_context_len check(context_notes is null or char_length(context_notes)<=3000)
);
create index if not exists daily_score_feedback_player_created_idx on public.daily_score_feedback(player_id,created_at desc);
alter table public.daily_score_feedback enable row level security;
revoke all on public.daily_score_feedback from anon,authenticated;
grant select,insert on public.daily_score_feedback to authenticated;
drop policy if exists dsf_recipient_read on public.daily_score_feedback;
create policy dsf_recipient_read on public.daily_score_feedback for select using(player_id=auth.uid());
drop policy if exists dsf_authorized_submit on public.daily_score_feedback;
create policy dsf_authorized_submit on public.daily_score_feedback for insert with check(
 can_rate(team_id,player_id) and exists(select 1 from public.daily_scores ds where ds.id=score_id and ds.team_id=team_id and ds.player_id=player_id)
);
create or replace function public.lock_daily_score_date_and_anonymize()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 new.score_date := (now() at time zone 'Asia/Kolkata')::date;
 new.evaluator_id := null; new.notes := null; new.improvement_target := null; new.review_visibility := 'recipient_only';
 return new;
end; $$;