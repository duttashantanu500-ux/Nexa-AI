/**
 * Server-side agent helpers (Supabase).
 * Requires schema_agents.sql + SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServerAgents(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export async function listDueAgentSchedules(limit = 10) {
  const sb = adminClient();
  if (!sb) return [];
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("nexa_schedules")
    .select("*, nexa_agents!inner(id, name, status, owner_user_id, current_version)")
    .eq("enabled", true)
    .lte("next_run_at", now)
    .limit(limit);
  if (error) {
    console.error("listDueAgentSchedules", error.message);
    return [];
  }
  return data || [];
}

export async function claimSchedule(id: string, oldNext: string | null, newNext: string | null) {
  const sb = adminClient();
  if (!sb) return false;
  let q = sb
    .from("nexa_schedules")
    .update({
      next_run_at: newNext,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (oldNext) q = q.eq("next_run_at", oldNext);
  const { data, error } = await q.select("id").maybeSingle();
  return !error && Boolean(data);
}

export async function recordScheduleFailure(id: string, status: string) {
  const sb = adminClient();
  if (!sb) return;
  const { data } = await sb
    .from("nexa_schedules")
    .select("consecutive_failures")
    .eq("id", id)
    .maybeSingle();
  const n = (data?.consecutive_failures || 0) + 1;
  await sb
    .from("nexa_schedules")
    .update({
      last_run_status: status,
      consecutive_failures: n,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function recordScheduleSuccess(id: string) {
  const sb = adminClient();
  if (!sb) return;
  await sb
    .from("nexa_schedules")
    .update({
      last_run_status: "succeeded",
      consecutive_failures: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export function computeNextRunIso(params: {
  type: string;
  timezone?: string;
  time_of_day?: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
}): string | null {
  if (params.type === "one_time") return null;
  const now = new Date();
  const [hh, mm] = (params.time_of_day || "09:00").split(":").map((x) => parseInt(x, 10) || 0);
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hh, mm, 0, 0);

  if (params.type === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  if (params.type === "weekly") {
    const target = params.day_of_week ?? 1;
    while (next.getDay() !== target || next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  if (params.type === "monthly") {
    const day = Math.min(params.day_of_month || 1, 28);
    next.setDate(day);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next.toISOString();
  }
  return null;
}

export async function listAgentsForUser(userId: string): Promise<any[]> {
  const sb = adminClient();
  if (!sb || !userId) return [];
  const { data, error } = await sb
    .from("nexa_agents")
    .select("*")
    .eq("owner_user_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("listAgentsForUser", error.message);
    return [];
  }
  return data || [];
}

export async function loadAgentSteps(agentId: string, version?: number): Promise<any[]> {
  const sb = adminClient();
  if (!sb) return [];
  if (typeof version === "number" && version > 0) {
    const { data, error } = await sb
      .from("nexa_agent_versions")
      .select("steps")
      .eq("agent_id", agentId)
      .eq("version", version)
      .maybeSingle();
    if (error) return [];
    return Array.isArray(data?.steps) ? data!.steps : [];
  }
  const { data, error } = await sb
    .from("nexa_agent_versions")
    .select("steps")
    .eq("agent_id", agentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return [];
  return Array.isArray(data?.steps) ? data!.steps : [];
}

export async function getAgentForUser(agentId: string, userId: string): Promise<any | null> {
  const sb = adminClient();
  if (!sb) return null;
  const { data: agent } = await sb
    .from("nexa_agents")
    .select("*")
    .eq("id", agentId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!agent) return null;
  const steps = await loadAgentSteps(agentId, agent.current_version);
  const { data: sch } = await sb
    .from("nexa_schedules")
    .select("*")
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { ...agent, steps, schedule: sch || null };
}

export async function upsertServerAgent(params: {
  userId: string;
  agentId?: string;
  name: string;
  description?: string;
  purpose?: string;
  status?: string;
  steps: any[];
  schedule?: any;
}): Promise<{ ok: true; id: string; version: number } | { ok: false; error: string }> {
  const sb = adminClient();
  if (!sb) return { ok: false, error: "Server storage is not configured." };
  if (!params.userId || !params.name?.trim()) return { ok: false, error: "Name is required." };

  const status = params.status || "active";
  const description = params.description || params.purpose || "";
  let agentId = params.agentId || "";
  let version = 1;

  if (agentId) {
    const { data: existing } = await sb
      .from("nexa_agents")
      .select("id, current_version, owner_user_id")
      .eq("id", agentId)
      .maybeSingle();
    if (!existing || existing.owner_user_id !== params.userId) {
      return { ok: false, error: "Employee not found." };
    }
    version = (existing.current_version || 1) + 1;
    const { error } = await sb
      .from("nexa_agents")
      .update({
        name: params.name.trim().slice(0, 120),
        description: description.slice(0, 500),
        status,
        current_version: version,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .eq("owner_user_id", params.userId);
    if (error) return { ok: false, error: "Could not update employee." };
  } else {
    const { data: created, error } = await sb
      .from("nexa_agents")
      .insert({
        owner_user_id: params.userId,
        name: params.name.trim().slice(0, 120),
        description: description.slice(0, 500),
        status,
        current_version: 1,
      })
      .select("id")
      .maybeSingle();
    if (error || !created?.id) return { ok: false, error: "Could not create employee." };
    agentId = created.id;
    version = 1;
  }

  const stepsJson = (params.steps || []).map((s: any, i: number) => ({
    id: String(s.id || `step_${i}`),
    actionId: String(s.actionId || ""),
    name: String(s.name || s.actionId || `Step ${i + 1}`),
    order: typeof s.order === "number" ? s.order : i,
    config: s.config && typeof s.config === "object" ? s.config : {},
    onError: s.onError === "continue" || s.onError === "retry" ? s.onError : "stop",
  }));

  await sb.from("nexa_agent_versions").insert({
    agent_id: agentId,
    version,
    steps: stepsJson,
    created_by: params.userId,
  });

  const freq = params.schedule?.frequency || "once";
  const enabled =
    Boolean(params.schedule?.enabled) && freq !== "once" && status !== "paused";
  const type =
    freq === "daily" || freq === "weekly" || freq === "monthly" ? freq : "one_time";
  const timeOfDay = params.schedule?.time || "09:00";
  const nextRun = enabled
    ? computeNextRunIso({ type, time_of_day: timeOfDay })
    : null;

  const { data: existingSch } = await sb
    .from("nexa_schedules")
    .select("id")
    .eq("agent_id", agentId)
    .limit(1)
    .maybeSingle();

  if (existingSch?.id) {
    await sb
      .from("nexa_schedules")
      .update({
        type,
        time_of_day: timeOfDay,
        enabled,
        next_run_at: nextRun,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSch.id);
  } else if (enabled) {
    await sb.from("nexa_schedules").insert({
      agent_id: agentId,
      type,
      time_of_day: timeOfDay,
      enabled,
      next_run_at: nextRun,
    });
  }

  return { ok: true, id: agentId, version };
}

export async function setAgentStatusForUser(
  agentId: string,
  userId: string,
  status: string
): Promise<boolean> {
  const sb = adminClient();
  if (!sb) return false;
  const { data, error } = await sb
    .from("nexa_agents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", agentId)
    .eq("owner_user_id", userId)
    .select("id")
    .maybeSingle();
  if (error || !data) return false;
  const enabled = status === "active" || status === "ready";
  await sb
    .from("nexa_schedules")
    .update({
      enabled,
      updated_at: new Date().toISOString(),
      ...(enabled ? {} : { next_run_at: null }),
    })
    .eq("agent_id", agentId);
  return true;
}

export async function archiveAgentForUser(agentId: string, userId: string): Promise<boolean> {
  return setAgentStatusForUser(agentId, userId, "archived");
}

export async function createAgentRun(params: {
  agentId: string;
  agentVersion: number;
  triggerSource: string;
  isTest?: boolean;
}): Promise<string | null> {
  const sb = adminClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("nexa_runs")
    .insert({
      agent_id: params.agentId,
      agent_version: params.agentVersion,
      trigger_source: params.triggerSource,
      status: "running",
      is_test: Boolean(params.isTest),
      started_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return data?.id || null;
}

export async function finishAgentRun(
  runId: string | null,
  result: { ok?: boolean; status?: string; error?: string; steps?: any[]; output?: string }
) {
  const sb = adminClient();
  if (!sb || !runId) return;
  const status =
    result.status === "waiting_for_approval"
      ? "waiting_approval"
      : result.ok
        ? "completed"
        : "failed";
  await sb
    .from("nexa_runs")
    .update({ status, ended_at: new Date().toISOString() })
    .eq("id", runId);
}

export async function listRunsForAgent(
  agentId: string,
  userId: string,
  limit = 30
): Promise<any[]> {
  const sb = adminClient();
  if (!sb) return [];
  const { data: agent } = await sb
    .from("nexa_agents")
    .select("id")
    .eq("id", agentId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!agent) return [];
  const { data } = await sb
    .from("nexa_runs")
    .select("*")
    .eq("agent_id", agentId)
    .eq("is_test", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}
