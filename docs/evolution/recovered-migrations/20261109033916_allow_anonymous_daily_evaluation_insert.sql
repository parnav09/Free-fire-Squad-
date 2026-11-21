drop policy if exists ds_insert on public.daily_scores;
create policy ds_insert on public.daily_scores for insert
with check (evaluator_id is null and can_rate(team_id,player_id) and score_date=(now() at time zone 'Asia/Kolkata')::date);