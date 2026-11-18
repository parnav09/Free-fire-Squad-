alter table public.profiles add column if not exists recovery_email text;
alter table public.profiles add column if not exists recovery_email_verified_at timestamptz;
create unique index if not exists profiles_recovery_email_unique on public.profiles (lower(recovery_email)) where recovery_email_verified_at is not null;
create table if not exists public.account_recovery_otps (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 otp_hash text not null,
 expires_at timestamptz not null,
 attempts smallint not null default 0,
 created_at timestamptz not null default now()
);
alter table public.account_recovery_otps enable row level security;
revoke all on public.account_recovery_otps from anon, authenticated;
