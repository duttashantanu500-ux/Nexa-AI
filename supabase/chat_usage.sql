-- Run once in Supabase SQL editor.
-- Extends monthly usage with chat message counts (per user).

create table if not exists public.nexa_usage_monthly (
  user_id text not null,
  period_key text not null,
  runs_count integer not null default 0,
  chat_messages integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_key)
);

-- Safe if table already exists without chat_messages:
alter table public.nexa_usage_monthly
  add column if not exists chat_messages integer not null default 0;

create index if not exists nexa_usage_monthly_user_idx
  on public.nexa_usage_monthly (user_id);

comment on column public.nexa_usage_monthly.chat_messages is
  'User + assistant messages counted for main / employee chat this calendar month (UTC).';
