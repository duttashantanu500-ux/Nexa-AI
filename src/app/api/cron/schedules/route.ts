import { NextRequest, NextResponse } from "next/server";
import { buildPlan, executeResearchMission } from "@/lib/agentEngine";
import { computeNextRun, ScheduleCadence } from "@/lib/schedules";
import {
  claimDueJobs,
  completeJob,
  failJob,
  getMissionRow,
  hasServerMissions,
  listDueScheduledMissions,
  enqueueJob,
  upsertServerMission,
} from "@/lib/serverMissions";

export const maxDuration = 60;

async function runMissionJob(missionId: string) {
  const row = await getMissionRow(missionId);
  if (!row) return { ok: false, error: "mission_not_found" };

  const plan =
    row.plan && Array.isArray(row.plan) && row.plan.length
      ? {
          title: row.title,
          objective: row.goal,
          steps: row.plan,
          researchQuery: row.research_query || row.goal,
        }
      : buildPlan(row.goal, null);

  await upsertServerMission({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    goal: row.goal,
    status: "running",
    progress: 20,
    plan: plan.steps,
    activity: [
      ...(row.activity || []),
      {
        id: `a_${Date.now()}`,
        text: "Background worker picked up mission",
        at: new Date().toISOString(),
        type: "info",
      },
    ],
    research_query: plan.researchQuery,
  });

  const result = await executeResearchMission({
    goal: row.goal,
    business: null,
    plan,
    maxPages: 6,
  });

  const activity = [
    ...(row.activity || []),
    {
      id: `a_${Date.now()}_start`,
      text: "Background worker picked up mission",
      at: new Date().toISOString(),
      type: "info",
    },
    ...(result.activity || []).map((text: string, i: number) => ({
      id: `a_${Date.now()}_${i}`,
      text,
      at: new Date().toISOString(),
      type: "info" as const,
    })),
  ];

  let next_run_at = row.next_run_at;
  if (row.schedule_cadence && result.ok) {
    next_run_at = computeNextRun(row.schedule_cadence as ScheduleCadence);
  }

  await upsertServerMission({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    goal: row.goal,
    status: result.ok ? "completed" : "failed",
    progress: result.progress,
    plan: result.steps,
    activity,
    deliverable: result.deliverable || null,
    result: result.deliverable?.content,
    error: result.error,
    research_query: plan.researchQuery,
    last_run_at: new Date().toISOString(),
    next_run_at,
    schedule_cadence: row.schedule_cadence,
  });

  return result;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  // Allow Vercel cron (no auth header) when CRON_SECRET unset; require Bearer when set
  if (secret && auth !== `Bearer ${secret}`) {
    const isVercelCron = req.headers.get("x-vercel-cron");
    if (!isVercelCron && auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!hasServerMissions()) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      message:
        "Add SUPABASE_SERVICE_ROLE_KEY + run supabase/missions_schema.sql to enable 24/7 queue",
      at: new Date().toISOString(),
    });
  }

  let processed = 0;
  const errors: string[] = [];

  // 1) Enqueue due scheduled missions
  const due = await listDueScheduledMissions(10);
  for (const m of due) {
    await enqueueJob({ missionId: m.id, userId: m.user_id });
    await upsertServerMission({
      id: m.id,
      user_id: m.user_id,
      title: m.title,
      goal: m.goal,
      status: "ready",
      next_run_at: m.schedule_cadence
        ? computeNextRun(m.schedule_cadence as ScheduleCadence)
        : null,
      schedule_cadence: m.schedule_cadence,
    });
  }

  // 2) Claim and run jobs
  const jobs = await claimDueJobs(3);
  for (const job of jobs) {
    try {
      const result = await runMissionJob(job.mission_id);
      if (result.ok) {
        await completeJob(job.id);
      } else {
        const retry = (job.attempts || 1) < (job.max_attempts || 3);
        await failJob(job.id, result.error || "failed", retry);
      }
      processed++;
    } catch (e: any) {
      const retry = (job.attempts || 1) < (job.max_attempts || 3);
      await failJob(job.id, e?.message || "error", retry);
      errors.push(e?.message || "error");
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    scheduledEnqueued: due.length,
    errors,
    at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  // Manual kick of the worker (same as cron)
  return GET(req);
}
