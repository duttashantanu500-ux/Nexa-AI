import { NextRequest, NextResponse } from "next/server";
import {
  claimSchedule,
  computeNextRunIso,
  hasServerAgents,
  listDueAgentSchedules,
  recordScheduleFailure,
  recordScheduleSuccess,
  loadAgentSteps,
  createAgentRun,
  finishAgentRun,
} from "@/lib/serverAgents";
import { runWorkflow } from "@/lib/workflowEngine";
import type { WorkflowStep } from "@/types";

export const maxDuration = 60;

/**
 * Server poller for agent schedules.
 * Requires Supabase tables from schema_agents.sql + token vault (oauth tokens).
 * Executes real workflow steps for each due schedule (multi-connector).
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
        "Supabase not configured. Client-side schedules still need the user to open the app (Run due). Server schedules need schema_agents.sql + SUPABASE_SERVICE_ROLE_KEY.",
      at: new Date().toISOString(),
    });
  }

  const due = await listDueAgentSchedules(10);
  let claimed = 0;
  let executed = 0;
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

    const userId = String(agent.owner_user_id || "");
    const version = Number(agent.current_version || 1);
    const stepsRaw = await loadAgentSteps(agent.id, version);
    const steps: WorkflowStep[] = (stepsRaw || []).map((s: any, i: number) => ({
      id: String(s.id || `step_${i}`),
      actionId: String(s.actionId || s.action_id || ""),
      name: String(s.name || s.actionId || s.action_id || `Step ${i + 1}`),
      order: typeof s.order === "number" ? s.order : i,
      config: (s.config && typeof s.config === "object" ? s.config : {}) as Record<
        string,
        string
      >,
      onError: s.onError === "continue" || s.onError === "retry" ? s.onError : "stop",
      requiresApproval: Boolean(s.requiresApproval),
    }));

    if (!steps.length) {
      await recordScheduleFailure(row.id, "no_steps");
      notes.push(`agent ${agent.name}: no steps in version ${version}`);
      continue;
    }

    const runId = await createAgentRun({
      agentId: agent.id,
      agentVersion: version,
      triggerSource: "schedule",
    });

    try {
      const result = await runWorkflow({
        steps,
        simulate: false,
        connections: { userId },
      });

      await finishAgentRun(runId, result);

      if (result.ok || result.status === "succeeded_with_errors" || result.status === "partial") {
        await recordScheduleSuccess(row.id);
        executed++;
        notes.push(
          `ran ${agent.name}: ${result.status} (${result.steps?.length || 0} steps)`
        );
      } else if (result.status === "waiting_for_approval") {
        await recordScheduleSuccess(row.id);
        notes.push(`agent ${agent.name}: waiting for approval`);
      } else {
        await recordScheduleFailure(row.id, result.status || "failed");
        notes.push(`agent ${agent.name}: failed — ${result.error || result.status}`);
      }
    } catch (e: any) {
      await recordScheduleFailure(row.id, "exception");
      if (runId) await finishAgentRun(runId, { ok: false, status: "failed", error: e?.message });
      notes.push(`agent ${agent.name}: exception ${e?.message || e}`);
    }
  }

  return NextResponse.json({
    ok: true,
    due: due.length,
    claimed,
    executed,
    notes,
    at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
