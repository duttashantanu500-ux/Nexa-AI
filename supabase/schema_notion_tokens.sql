-- Notion (and future connector) OAuth tokens — run in Supabase SQL editor
-- Service role or RLS policies as appropriate for your setup.

create table if not exists public.nexa_oauth_tokens (
  user_id text not null,
  connector_id text not null,
  ciphertext text not null,
  workspace_name text,
  workspace_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, connector_id)
);

create index if not exists nexa_oauth_tokens_connector_idx
  on public.nexa_oauth_tokens (connector_id);

alter table public.nexa_oauth_tokens enable row level security;

-- No public policies: access only via service role from Nexa server.
