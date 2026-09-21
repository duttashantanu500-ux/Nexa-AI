-- Nexa Supabase schema
-- Run this in Supabase SQL Editor (Project → SQL → New query)

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  user_type text check (user_type in ('founder', 'business_owner', 'agency')),
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Business context (shared across workspaces)
create table if not exists public.business_contexts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Conversations
create table if not exists public.conversations (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace text not null,
  title text not null default 'New conversation',
  message_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists conversations_user_ws_idx
  on public.conversations (user_id, workspace, updated_at desc);

-- Messages
create table if not exists public.messages (
  id uuid primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  request_id text,
  status text,
  attachments jsonb,
  created_at timestamptz default now()
);

create index if not exists messages_conv_idx
  on public.messages (conversation_id, created_at);

-- Long-term memories
create table if not exists public.memories (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  category text,
  importance int default 5,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists memories_user_idx
  on public.memories (user_id, importance desc);

-- RLS
alter table public.profiles enable row level security;
alter table public.business_contexts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;

-- Policies: users only access their own rows
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "business_own" on public.business_contexts;
create policy "business_own" on public.business_contexts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "conversations_own" on public.conversations;
create policy "conversations_own" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "messages_own" on public.messages;
create policy "messages_own" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "memories_own" on public.memories;
create policy "memories_own" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
