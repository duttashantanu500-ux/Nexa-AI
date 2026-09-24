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

export function hasServerMissions(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export async function upsertServerMission(row: {
  id: string;
  user_id: string;
  title: string;
  goal: string;
  status: string;
  progress?: number;
  plan?: unknown;
  activity?: unknown;
  deliverable?: unknown;
  result?: string;
  research_query?: string;
  error?: string;
  schedule_cadence?: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  checkpoint?: unknown;
}) {
  const sb = adminClient();
  if (!sb) return { ok: false as const, error: "supabase_not_configured" };

  const { error } = await sb.from("missions").upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function enqueueJob(params: {
  missionId: string;
  userId: string;
  kind?: string;
  runAfter?: string;
}) {
  const sb = adminClient();
  if (!sb) return { ok: false as const, error: "supabase_not_configured" };

  const { error } = await sb.from("job_queue").insert({
    mission_id: params.missionId,
    user_id: params.userId,
    kind: params.kind || "execute",
    status: "pending",
    run_after: params.runAfter || new Date().toISOString(),
  });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function claimDueJobs(limit = 5) {
  const sb = adminClient();
  if (!sb) return [];

  const now = new Date().toISOString();
  const { data: jobs } = await sb
    .from("job_queue")
    .select("*")
    .in("status", ["pending", "retry"])
    .lte("run_after", now)
    .order("run_after", { ascending: true })
    .limit(limit);

  if (!jobs?.length) return [];

  const claimed = [];
  for (const job of jobs) {
    const { data, error } = await sb
      .from("job_queue")
      .update({
        status: "running",
        locked_at: now,
        attempts: (job.attempts || 0) + 1,
        updated_at: now,
      })
      .eq("id", job.id)
      .in("status", ["pending", "retry"])
      .select("*")
      .maybeSingle();
    if (!error && data) claimed.push(data);
  }
  return claimed;
}

export async function completeJob(id: string) {
  const sb = adminClient();
  if (!sb) return;
  await sb
    .from("job_queue")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function failJob(id: string, err: string, retry = false) {
  const sb = adminClient();
  if (!sb) return;
  const runAfter = new Date(Date.now() + 60_000).toISOString();
  await sb
    .from("job_queue")
    .update({
      status: retry ? "retry" : "failed",
      last_error: err,
      run_after: retry ? runAfter : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function getMissionRow(id: string) {
  const sb = adminClient();
  if (!sb) return null;
  const { data } = await sb.from("missions").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function listDueScheduledMissions(limit = 10) {
  const sb = adminClient();
  if (!sb) return [];
  const now = new Date().toISOString();
  const { data } = await sb
    .from("missions")
    .select("*")
    .not("next_run_at", "is", null)
    .lte("next_run_at", now)
    .in("status", ["ready", "completed"])
    .limit(limit);
  return data || [];
}
