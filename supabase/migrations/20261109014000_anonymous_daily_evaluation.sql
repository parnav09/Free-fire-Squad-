-- Anonymous, recipient-focused Daily Evolution feedback.
alter table public.daily_scores alter column evaluator_id drop not null;
alter table public.daily_scores add column if not exists improvement_notes text;
alter table public.daily_scores add column if not exists mistake_notes text;
alter table public.daily_scores add column if not exists review_visibility text not null default 'recipient_only';
alter table public.daily_scores add constraint daily_scores_improvement_notes_len check (improvement_notes is null or char_length(improvement_notes) <= 10000);
alter table public.daily_scores add constraint daily_scores_mistake_notes_len check (mistake_notes is null or char_length(mistake_notes) <= 10000);
comment on column public.daily_scores.evaluator_id is 'NULL for anonymous player evaluations; evaluator identity is not stored.';
comment on column public.daily_scores.review_visibility is 'Recipient-focused feedback visibility.';

create or replace function public.lock_daily_score_date_and_anonymize()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.score_date := (now() at time zone 'Asia/Kolkata')::date;
  new.evaluator_id := null;
  return new;
end;
$$;
drop trigger if exists daily_scores_lock_date_anonymous on public.daily_scores;
create trigger daily_scores_lock_date_anonymous
before insert on public.daily_scores
for each row execute function public.lock_daily_score_date_and_anonymize();


drop policy if exists ds_insert on public.daily_scores;
create policy ds_insert on public.daily_scores for insert
with check (evaluator_id is null and can_rate(team_id,player_id) and score_date=(now() at time zone 'Asia/Kolkata')::date);
