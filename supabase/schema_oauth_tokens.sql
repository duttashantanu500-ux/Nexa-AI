-- Run in Supabase SQL editor for durable Notion/Slack (and future OAuth) token storage.
-- Tokens are stored encrypted (ciphertext only).
-- The Nexa server reads/writes with SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).

create table if not exists public.nexa_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  connector_id text not null,
  ciphertext text not null,
  workspace_name text,
  workspace_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, connector_id)
);

create index if not exists nexa_oauth_tokens_user_idx
  on public.nexa_oauth_tokens (user_id);

-- RLS on: browser never touches this table. Server uses service role key.
alter table public.nexa_oauth_tokens enable row level security;

-- No public policies — only service role (server) may access rows.
