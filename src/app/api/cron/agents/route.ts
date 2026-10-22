import { NextRequest, NextResponse } from "next/server";
import {
  claimSchedule,
  computeNextRunIso,
  createAgentRun,
  finishAgentRun,
  hasServerAgents,
  listDueAgentSchedules,
  loadAgentSteps,
  recordScheduleFailure,
  recordScheduleSuccess,
} from "@/lib/serverAgents";
import { runWorkflow } from "@/lib/workflowEngine";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server poller for AI Employee schedules.
 * Claims due schedules, loads steps, runs real connector workflow for that user.
 * Never marks success without executing (or an honest wait-for-approval outcome).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    const isVercelCron = req.headers.get("x-vercel-cron");
    if (!isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!hasServerAgents()) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      message:
        "Supabase not configured. Server schedules need schema_agents.sql + SUPABASE_SERVICE_ROLE_KEY.",
      at: new Date().toISOString(),
    });
  }

  const due = await listDueAgentSchedules(5);
  let claimed = 0;
  let executed = 0;
  let failed = 0;
  let waitingApproval = 0;
  const notes: string[] = [];

  for (const row of due as any[]) {
    const agent = row.nexa_agents;
    if (!agent || agent.status === "paused" || agent.status === "archived") {
      notes.push(`skip ${row.id}: agent not active`);
      continue;
    }

    const next = computeNextRunIso({
      type: row.type,
      time_of_day: row.time_of_day,
      day_of_week: row.day_of_week,
      day_of_month: row.day_of_month,
    });

    const ok = await claimSchedule(row.id, row.next_run_at, next);
    if (!ok) {
      notes.push(`skip ${row.id}: claim lost (duplicate prevention)`);
      continue;
    }
    claimed++;

    const userId = String(agent.owner_user_id || "").trim();
    const agentId = String(agent.id || "").trim();
    if (!userId || !agentId) {
      await recordScheduleFailure(row.id, "failed");
      failed++;
      notes.push(`fail ${row.id}: missing user or agent id`);
      continue;
    }

    try {
      const steps = await loadAgentSteps(agentId, agent.current_version);
      if (!steps.length) {
        await recordScheduleFailure(row.id, "failed");
        failed++;
        notes.push(`fail ${agent.name}: no steps`);
        continue;
      }

      const workflowSteps = steps.map((s: any, i: number) => ({
        id: String(s.id || `step_${i}`),
        actionId: String(s.actionId || ""),
        name: String(s.name || s.actionId || `Step ${i + 1}`),
        order: typeof s.order === "number" ? s.order : i,
        config: (s.config && typeof s.config === "object" ? s.config : {}) as Record<
          string,
          string
        >,
        onError:
          s.onError === "continue" || s.onError === "retry"
            ? s.onError
            : ("stop" as const),
        requiresApproval: Boolean(s.requiresApproval),
      }));

      const runId = await createAgentRun({
        agentId,
        agentVersion: agent.current_version || 1,
        triggerSource: `schedule:${row.id}`,
        isTest: false,
      });

      const result = await runWorkflow({
        steps: workflowSteps,
        simulate: false,
        connections: {
          userId,
          origin:
            process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
            (process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`
              : undefined),
        },
      });

      await finishAgentRun(runId, {
        ok: result.ok,
        status: result.status,
        error: result.error,
        steps: result.steps,
        output: result.output,
      });

      if (result.status === "waiting_for_approval") {
        await recordScheduleSuccess(row.id);
        waitingApproval++;
        notes.push(
          `agent ${agent.name}: waiting for approval on step ${result.pendingStepId || ""}`
        );
      } else if (result.ok || result.status === "completed") {
        await recordScheduleSuccess(row.id);
        executed++;
        notes.push(`agent ${agent.name}: completed`);
      } else if (result.status === "succeeded_with_errors") {
        await recordScheduleSuccess(row.id);
        executed++;
        notes.push(`agent ${agent.name}: completed with errors`);
      } else {
        await recordScheduleFailure(row.id, "failed");
        failed++;
        notes.push(`agent ${agent.name}: failed — ${result.error || result.status}`);
      }
    } catch (e) {
      await recordScheduleFailure(row.id, "failed");
      failed++;
      notes.push(
        `agent ${agent?.name || row.id}: exception — ${
          e instanceof Error ? e.message : "error"
        }`
      );
    }
  }

  return NextResponse.json({
    ok: true,
    due: due.length,
    claimed,
    executed,
    failed,
    waitingApproval,
    notes,
    at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
