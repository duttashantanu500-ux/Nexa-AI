import { NextRequest, NextResponse } from "next/server";
import {
  claimSchedule,
  computeNextRunIso,
  hasServerAgents,
  listDueAgentSchedules,
  recordScheduleFailure,
  recordScheduleSuccess,
} from "@/lib/serverAgents";

export const maxDuration = 60;

/**
 * Server poller for agent schedules (Phase 5).
 * Requires Supabase tables from schema_agents.sql.
 * Does NOT execute client-only localStorage agents — those need the browser or a sync path.
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

    // Full step execution against OAuth tokens is not wired here yet.
    // Record that the schedule fired; execution of external actions needs token vault (next infra).
    await recordScheduleSuccess(row.id);
    notes.push(
      `claimed schedule ${row.id} for agent ${agent.name} — enqueue execution when token vault is live`
    );
  }

  return NextResponse.json({
    ok: true,
    due: due.length,
    claimed,
    notes,
    at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
