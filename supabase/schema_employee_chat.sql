-- Persistent AI Employee Builder chat (one conversation per employee/draft)
-- Run in Supabase SQL editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.nexa_employee_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  scope_id TEXT NOT NULL,
  agent_id UUID,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_nexa_employee_chats_owner
  ON public.nexa_employee_chats (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_nexa_employee_chats_agent
  ON public.nexa_employee_chats (agent_id)
  WHERE agent_id IS NOT NULL;

ALTER TABLE public.nexa_employee_chats ENABLE ROW LEVEL SECURITY;
