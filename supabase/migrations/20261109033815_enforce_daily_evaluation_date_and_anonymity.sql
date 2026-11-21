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