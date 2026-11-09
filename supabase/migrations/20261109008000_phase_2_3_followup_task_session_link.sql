alter table public.practice_tasks add column if not exists source_session_id uuid references public.training_sessions(id) on delete set null;
