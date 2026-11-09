alter table public.practice_tasks add column if not exists blocked_reason text not null default '';
alter table public.practice_tasks add column if not exists task_category text not null default 'individual';
alter table public.practice_tasks add column if not exists estimated_minutes integer check (estimated_minutes between 1 and 1440);
