create table if not exists public.practice_plans (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
 title text not null check(length(trim(title)) between 2 and 120), plan_date date not null,
 plan_type text not null default 'daily' check(plan_type in ('daily','weekly','scrim','tournament','custom')),
 focus text not null default '', objectives text[] not null default '{}', notes text not null default '',
 status text not null default 'draft' check(status in ('draft','scheduled','in_progress','completed','reviewed','archived')),
 planned_minutes integer not null default 0 check(planned_minutes between 0 and 1440),
 actual_minutes integer check(actual_minutes between 0 and 1440), review_notes text not null default '',
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), completed_at timestamptz, reviewed_at timestamptz
);
create index if not exists practice_plans_team_date_idx on public.practice_plans(team_id,plan_date desc);
create table if not exists public.practice_plan_blocks (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
 plan_id uuid not null references public.practice_plans(id) on delete cascade,
 title text not null check(length(trim(title)) between 2 and 120), category text not null default 'team',
 instructions text not null default '', expected_outcome text not null default '',
 duration_minutes integer not null default 15 check(duration_minutes between 1 and 480),
 sort_order integer not null default 0, linked_drill_id uuid, created_at timestamptz not null default now()
);
create index if not exists practice_plan_blocks_plan_idx on public.practice_plan_blocks(plan_id,sort_order);
create table if not exists public.practice_tasks (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
 plan_id uuid references public.practice_plans(id) on delete set null,
 block_id uuid references public.practice_plan_blocks(id) on delete set null,
 player_member_id uuid references public.team_members(id) on delete set null,
 title text not null check(length(trim(title)) between 2 and 160), instructions text not null default '',
 priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
 status text not null default 'assigned' check(status in ('assigned','in_progress','completed','reviewed','blocked','cancelled')),
 due_date date, estimated_minutes integer check(estimated_minutes between 1 and 480),
 success_criteria text not null default '', completion_note text not null default '', review_feedback text not null default '',
 assigned_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), completed_at timestamptz, reviewed_at timestamptz
);
create index if not exists practice_tasks_team_due_idx on public.practice_tasks(team_id,due_date,status);
create index if not exists practice_tasks_player_idx on public.practice_tasks(player_member_id,status);
create table if not exists public.training_drills (
 id uuid primary key default gen_random_uuid(), team_id uuid references public.teams(id) on delete cascade,
 is_template boolean not null default false, title text not null check(length(trim(title)) between 2 and 160),
 category text not null default 'individual', difficulty text not null default 'medium' check(difficulty in ('beginner','medium','advanced','elite')),
 role_tags text[] not null default '{}', duration_minutes integer not null default 15 check(duration_minutes between 1 and 480),
 objective text not null default '', setup text not null default '', steps text[] not null default '{}',
 success_criteria text not null default '', scoring_rubric jsonb not null default '{}', tags text[] not null default '{}',
 archived boolean not null default false, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists training_drills_team_category_idx on public.training_drills(team_id,category,archived);
create table if not exists public.training_sessions (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
 plan_id uuid references public.practice_plans(id) on delete set null, drill_id uuid references public.training_drills(id) on delete set null,
 title text not null check(length(trim(title)) between 2 and 160), session_type text not null default 'individual' check(session_type in ('individual','squad','communication','igl','role','custom')),
 scheduled_at timestamptz, duration_minutes integer not null default 15 check(duration_minutes between 1 and 480),
 status text not null default 'scheduled' check(status in ('scheduled','in_progress','completed','cancelled')),
 instructions text not null default '', coach_notes text not null default '', created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.training_results (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
 session_id uuid not null references public.training_sessions(id) on delete cascade,
 player_member_id uuid references public.team_members(id) on delete set null,
 attempt_number integer not null default 1 check(attempt_number between 1 and 100),
 score numeric(5,2) check(score between 0 and 100), rubric jsonb not null default '{}',
 completed boolean not null default false, player_reflection text not null default '', coach_feedback text not null default '',
 next_action text not null default '', replay_reference text not null default '',
 submitted_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 unique(session_id,player_member_id,attempt_number)
);
create index if not exists training_results_session_idx on public.training_results(session_id,created_at desc);
do $$ declare t text; begin foreach t in array array['practice_plans','practice_plan_blocks','practice_tasks','training_drills','training_sessions','training_results'] loop execute format('alter table public.%I enable row level security',t); execute format('drop policy if exists squad_team_read on public.%I',t); execute format('create policy squad_team_read on public.%I for select to authenticated using (exists(select 1 from public.team_members tm where tm.team_id=%I.team_id and tm.user_id=auth.uid() and tm.status=''active''))',t,t); execute format('drop policy if exists squad_staff_write on public.%I',t); execute format('create policy squad_staff_write on public.%I for all to authenticated using (exists(select 1 from public.team_members tm where tm.team_id=%I.team_id and tm.user_id=auth.uid() and tm.status=''active'' and tm.membership_role in (''owner'',''coach''))) with check (exists(select 1 from public.team_members tm where tm.team_id=%I.team_id and tm.user_id=auth.uid() and tm.status=''active'' and tm.membership_role in (''owner'',''coach'')))',t,t,t); end loop; end $$;
grant select,insert,update,delete on public.practice_plans,public.practice_plan_blocks,public.practice_tasks,public.training_drills,public.training_sessions,public.training_results to authenticated;