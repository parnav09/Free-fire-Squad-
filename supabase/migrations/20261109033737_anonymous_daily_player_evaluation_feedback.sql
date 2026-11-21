alter table public.daily_scores alter column evaluator_id drop not null;
alter table public.daily_scores add column if not exists improvement_notes text;
alter table public.daily_scores add column if not exists mistake_notes text;
alter table public.daily_scores add column if not exists review_visibility text not null default 'recipient_only';
alter table public.daily_scores add constraint daily_scores_improvement_notes_len check (improvement_notes is null or char_length(improvement_notes) <= 10000);
alter table public.daily_scores add constraint daily_scores_mistake_notes_len check (mistake_notes is null or char_length(mistake_notes) <= 10000);
comment on column public.daily_scores.evaluator_id is 'NULL for anonymous player evaluations; never persist evaluator identity for anonymous reviews.';
comment on column public.daily_scores.review_visibility is 'Recipient-only feedback visibility; evaluator identity intentionally omitted.';