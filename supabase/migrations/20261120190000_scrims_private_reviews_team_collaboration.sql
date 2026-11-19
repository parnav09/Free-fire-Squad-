-- Keep personal post-Scrim reflections private while enabling shared team discussion and follow-up.
-- This migration is repository-only until the migration history is reconciled and production rollout is approved.

do $$
begin
  if not exists (select 1 from pg_constraint where conname='scrim_records_scope_unique') then
    alter table public.scrim_records
      add constraint scrim_records_scope_unique unique (id, team_id, owner_id);
  end if;
end
$$;

create table if not exists public.scrim_personal_reviews (
  id uuid primary key default gen_random_uuid(),
  scrim_id uuid not null unique references public.scrim_records(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  review jsonb not null default '{"strengths":[],"mistakes":[],"notes":"","nextGoal":"","reviewed":false}'::jsonb
    check (jsonb_typeof(review) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scrim_personal_review_owner_fk
    foreign key (scrim_id, team_id, owner_id)
    references public.scrim_records(id, team_id, owner_id)
    on delete cascade
);

-- Preserve every existing personal review before removing the team-readable JSON column.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scrim_records'
      and column_name = 'personal_review'
  ) then
    execute $copy$
      insert into public.scrim_personal_reviews
        (scrim_id, team_id, owner_id, review, created_at, updated_at)
      select id, team_id, owner_id, personal_review, created_at, updated_at
      from public.scrim_records
      on conflict (scrim_id) do nothing
    $copy$;
    alter table public.scrim_records drop column personal_review;
  end if;
end
$$;

create index if not exists scrim_personal_reviews_owner_idx
  on public.scrim_personal_reviews(owner_id, updated_at desc);

alter table public.scrim_personal_reviews enable row level security;

drop policy if exists "owners read own scrim personal reviews" on public.scrim_personal_reviews;
create policy "owners read own scrim personal reviews"
on public.scrim_personal_reviews for select to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_personal_reviews.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
  )
);

drop policy if exists "owners create own scrim personal reviews" on public.scrim_personal_reviews;
create policy "owners create own scrim personal reviews"
on public.scrim_personal_reviews for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_personal_reviews.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
  )
  and exists (
    select 1 from public.scrim_records sr
    where sr.id = scrim_personal_reviews.scrim_id
      and sr.team_id = scrim_personal_reviews.team_id
      and sr.owner_id = (select auth.uid())
  )
);

drop policy if exists "owners update own scrim personal reviews" on public.scrim_personal_reviews;
create policy "owners update own scrim personal reviews"
on public.scrim_personal_reviews for update to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_personal_reviews.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_personal_reviews.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
  )
  and exists (
    select 1 from public.scrim_records sr
    where sr.id = scrim_personal_reviews.scrim_id
      and sr.team_id = scrim_personal_reviews.team_id
      and sr.owner_id = (select auth.uid())
  )
);

drop policy if exists "owners delete own scrim personal reviews" on public.scrim_personal_reviews;
create policy "owners delete own scrim personal reviews"
on public.scrim_personal_reviews for delete to authenticated
using (owner_id = (select auth.uid()));

do $$
begin
  if not exists (select 1 from pg_constraint where conname='scrim_team_reviews_scope_unique') then
    alter table public.scrim_team_reviews
      add constraint scrim_team_reviews_scope_unique unique (id, scrim_id, team_id);
  end if;
end
$$;

create table if not exists public.scrim_team_review_comments (
  id uuid primary key default gen_random_uuid(),
  scrim_id uuid not null references public.scrim_records(id) on delete cascade,
  review_id uuid not null references public.scrim_team_reviews(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint scrim_team_review_comment_scope_fk
    foreign key (review_id, scrim_id, team_id)
    references public.scrim_team_reviews(id, scrim_id, team_id)
    on delete cascade
);

create index if not exists scrim_team_review_comments_review_idx
  on public.scrim_team_review_comments(review_id, created_at);

alter table public.scrim_team_review_comments enable row level security;

drop policy if exists "team members read scrim review comments" on public.scrim_team_review_comments;
create policy "team members read scrim review comments"
on public.scrim_team_review_comments for select to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_team_review_comments.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
  )
);

drop policy if exists "team members add scrim review comments" on public.scrim_team_review_comments;
create policy "team members add scrim review comments"
on public.scrim_team_review_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_team_review_comments.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
  )
  and exists (
    select 1 from public.scrim_team_reviews tr
    where tr.id = scrim_team_review_comments.review_id
      and tr.scrim_id = scrim_team_review_comments.scrim_id
      and tr.team_id = scrim_team_review_comments.team_id
  )
);

drop policy if exists "authors delete own scrim review comments" on public.scrim_team_review_comments;
create policy "authors delete own scrim review comments"
on public.scrim_team_review_comments for delete to authenticated
using (author_id = (select auth.uid()));

create table if not exists public.scrim_review_tasks (
  id uuid primary key default gen_random_uuid(),
  scrim_id uuid not null references public.scrim_records(id) on delete cascade,
  source_review_id uuid references public.scrim_team_reviews(id) on delete set null,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scrim_review_tasks_team_status_idx
  on public.scrim_review_tasks(team_id, status, due_date);

create index if not exists scrim_review_tasks_assignee_idx
  on public.scrim_review_tasks(assigned_to, status, due_date);

alter table public.scrim_review_tasks enable row level security;

drop policy if exists "team members read scrim review tasks" on public.scrim_review_tasks;
create policy "team members read scrim review tasks"
on public.scrim_review_tasks for select to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_review_tasks.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
  )
);

drop policy if exists "team leads create scrim review tasks" on public.scrim_review_tasks;
create policy "team leads create scrim review tasks"
on public.scrim_review_tasks for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_review_tasks.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and (
        tm.membership_role in ('owner','coach')
        or lower(coalesce(tm.assigned_role,'')) in ('igl','in-game leader')
      )
  )
  and exists (
    select 1 from public.scrim_records sr
    where sr.id = scrim_review_tasks.scrim_id
      and sr.team_id = scrim_review_tasks.team_id
  )
  and (
    scrim_review_tasks.assigned_to is null
    or exists (
      select 1 from public.team_members assignee
      where assignee.team_id = scrim_review_tasks.team_id
        and assignee.user_id = scrim_review_tasks.assigned_to
        and assignee.status = 'active'
    )
  )
  and (
    scrim_review_tasks.source_review_id is null
    or exists (
      select 1 from public.scrim_team_reviews tr
      where tr.id = scrim_review_tasks.source_review_id
        and tr.scrim_id = scrim_review_tasks.scrim_id
        and tr.team_id = scrim_review_tasks.team_id
    )
  )
);

drop policy if exists "team leads or assignees update scrim review tasks" on public.scrim_review_tasks;
create policy "team leads or assignees update scrim review tasks"
on public.scrim_review_tasks for update to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_review_tasks.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and (
        scrim_review_tasks.assigned_to = (select auth.uid())
        or tm.membership_role in ('owner','coach')
        or lower(coalesce(tm.assigned_role,'')) in ('igl','in-game leader')
      )
  )
)
with check (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_review_tasks.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and (
        scrim_review_tasks.assigned_to = (select auth.uid())
        or tm.membership_role in ('owner','coach')
        or lower(coalesce(tm.assigned_role,'')) in ('igl','in-game leader')
      )
  )
  and exists (
    select 1 from public.scrim_records sr
    where sr.id = scrim_review_tasks.scrim_id
      and sr.team_id = scrim_review_tasks.team_id
  )
  and (
    scrim_review_tasks.assigned_to is null
    or exists (
      select 1 from public.team_members assignee
      where assignee.team_id = scrim_review_tasks.team_id
        and assignee.user_id = scrim_review_tasks.assigned_to
        and assignee.status = 'active'
    )
  )
  and (
    scrim_review_tasks.source_review_id is null
    or exists (
      select 1 from public.scrim_team_reviews tr
      where tr.id = scrim_review_tasks.source_review_id
        and tr.scrim_id = scrim_review_tasks.scrim_id
        and tr.team_id = scrim_review_tasks.team_id
    )
  )
);

drop policy if exists "team leads delete scrim review tasks" on public.scrim_review_tasks;
create policy "team leads delete scrim review tasks"
on public.scrim_review_tasks for delete to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = scrim_review_tasks.team_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and (
        tm.membership_role in ('owner','coach')
        or lower(coalesce(tm.assigned_role,'')) in ('igl','in-game leader')
      )
  )
);
