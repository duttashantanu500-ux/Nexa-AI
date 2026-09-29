-- Nexa billing / subscription schema
-- Run in Supabase SQL Editor after core schema.

-- Per-user subscription state (source of truth for plan)
create table if not exists public.nexa_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'free'
    check (status in ('free', 'active', 'canceling', 'past_due', 'on_hold', 'expired', 'failed')),
  dodo_subscription_id text,
  dodo_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists nexa_subscriptions_dodo_sub_idx
  on public.nexa_subscriptions (dodo_subscription_id);

create index if not exists nexa_subscriptions_dodo_cust_idx
  on public.nexa_subscriptions (dodo_customer_id);

-- Monthly usage counters (agent runs)
create table if not exists public.nexa_usage_monthly (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null, -- YYYY-MM (UTC)
  runs_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_key)
);

-- Idempotent webhook processing
create table if not exists public.nexa_webhook_events (
  webhook_id text primary key,
  event_type text,
  processed_at timestamptz not null default now()
);

alter table public.nexa_subscriptions enable row level security;
alter table public.nexa_usage_monthly enable row level security;
alter table public.nexa_webhook_events enable row level security;

-- Users can read their own subscription + usage (writes via service role only)
drop policy if exists "subs_select_own" on public.nexa_subscriptions;
create policy "subs_select_own" on public.nexa_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "usage_select_own" on public.nexa_usage_monthly;
create policy "usage_select_own" on public.nexa_usage_monthly
  for select using (auth.uid() = user_id);

-- New users start on Free (also set from app on signup)
create or replace function public.nexa_init_free_subscription()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.nexa_subscriptions (user_id, plan, status)
  values (new.id, 'free', 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_free_sub on public.profiles;
create trigger on_profile_free_sub
  after insert on public.profiles
  for each row execute function public.nexa_init_free_subscription();
