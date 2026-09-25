-- Phase 1 additive schema for connector-first agents (run in Supabase SQL editor).
-- Safe to run multiple times with IF NOT EXISTS.
-- Tokens must only be written server-side; never expose to the client.

-- User connection instances (OAuth/API)
CREATE TABLE IF NOT EXISTS public.nexa_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id TEXT NOT NULL,
  owner_user_id UUID NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'setup_required'
    CHECK (status IN ('connected', 'expired', 'revoked', 'error', 'setup_required')),
  scopes_granted TEXT[] NOT NULL DEFAULT '{}',
  access_token_encrypted BYTEA,
  refresh_token_encrypted BYTEA,
  token_expires_at TIMESTAMPTZ,
  provider_account_ref TEXT,
  connected_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexa_connections_owner
  ON public.nexa_connections (owner_user_id);

-- Agents
CREATE TABLE IF NOT EXISTS public.nexa_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived', 'ready', 'failed', 'needs_setup')),
  current_version INT NOT NULL DEFAULT 1,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexa_agents_owner
  ON public.nexa_agents (owner_user_id);

-- Versioned step snapshots
CREATE TABLE IF NOT EXISTS public.nexa_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.nexa_agents(id) ON DELETE CASCADE,
  version INT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (agent_id, version)
);

-- Schedules (server poller target)
CREATE TABLE IF NOT EXISTS public.nexa_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.nexa_agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('one_time', 'daily', 'weekly', 'monthly')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  time_of_day TEXT NOT NULL DEFAULT '09:00',
  day_of_week INT,
  day_of_month INT,
  run_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  consecutive_failures INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexa_schedules_due
  ON public.nexa_schedules (enabled, next_run_at);

-- Runs
CREATE TABLE IF NOT EXISTS public.nexa_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.nexa_agents(id) ON DELETE CASCADE,
  agent_version INT NOT NULL DEFAULT 1,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  is_test BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nexa_runs_agent
  ON public.nexa_runs (agent_id, created_at DESC);

-- Per-step audit (false-success defense)
CREATE TABLE IF NOT EXISTS public.nexa_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.nexa_runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_sent JSONB,
  output_received JSONB,
  normalized_error JSONB,
  retry_count INT NOT NULL DEFAULT 0,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexa_run_steps_run
  ON public.nexa_run_steps (run_id);

-- Approvals
CREATE TABLE IF NOT EXISTS public.nexa_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.nexa_runs(id) ON DELETE CASCADE,
  run_step_id UUID REFERENCES public.nexa_run_steps(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID,
  decision TEXT CHECK (decision IS NULL OR decision IN ('approved', 'rejected'))
);

-- RLS placeholders (enable when using Supabase Auth user ids)
ALTER TABLE public.nexa_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexa_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexa_agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexa_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexa_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexa_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexa_approvals ENABLE ROW LEVEL SECURITY;
