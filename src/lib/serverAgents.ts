/**
 * Server-side agent schedule helpers (Supabase).
 * Requires schema from supabase/schema_agents.sql + SERVICE_ROLE_KEY.
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

/** Compare-and-set claim to reduce double-fire */
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
