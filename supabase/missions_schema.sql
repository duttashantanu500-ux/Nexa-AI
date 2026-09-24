-- Run in Supabase SQL Editor for 24/7 mission persistence

create table if not exists public.missions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal text not null,
  status text not null default 'ready',
  progress int default 0,
  plan jsonb default '[]'::jsonb,
  activity jsonb default '[]'::jsonb,
  deliverable jsonb,
  result text,
  research_query text,
  error text,
  schedule_cadence text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  checkpoint jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists missions_user_idx on public.missions (user_id, updated_at desc);
create index if not exists missions_due_idx on public.missions (status, next_run_at);

create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'execute',
  status text not null default 'pending',
  attempts int default 0,
  max_attempts int default 3,
  run_after timestamptz default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists job_queue_due_idx
  on public.job_queue (status, run_after)
  where status in ('pending', 'retry');

alter table public.missions enable row level security;
alter table public.job_queue enable row level security;

drop policy if exists "missions_own" on public.missions;
create policy "missions_own" on public.missions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Jobs are processed by service role / cron; users can read their own
drop policy if exists "jobs_own_read" on public.job_queue;
create policy "jobs_own_read" on public.job_queue
  for select using (auth.uid() = user_id);
