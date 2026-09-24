import { NextRequest, NextResponse } from "next/server";
import {
  enqueueJob,
  hasServerMissions,
  upsertServerMission,
} from "@/lib/serverMissions";
import { computeNextRun, ScheduleCadence } from "@/lib/schedules";

export async function POST(req: NextRequest) {
  try {
    if (!hasServerMissions()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Server missions not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run supabase/missions_schema.sql",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const {
      id,
      userId,
      title,
      goal,
      plan,
      researchQuery,
      scheduleCadence,
      runNow = true,
    } = body;

    if (!id || !userId || !goal) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const cadence = (scheduleCadence || null) as ScheduleCadence | null;
    const next_run_at = cadence ? computeNextRun(cadence) : null;

    const up = await upsertServerMission({
      id,
      user_id: userId,
      title: title || goal.slice(0, 48),
      goal,
      status: runNow ? "ready" : "ready",
      progress: 0,
      plan: plan || [],
      activity: [
        {
          id: `a_${Date.now()}`,
          text: runNow
            ? "Queued for background execution"
            : "Scheduled on server",
          at: new Date().toISOString(),
          type: "info",
        },
      ],
      research_query: researchQuery,
      schedule_cadence: cadence || undefined,
      next_run_at,
      checkpoint: {},
    });

    if (!up.ok) {
      return NextResponse.json({ ok: false, error: up.error }, { status: 500 });
    }

    if (runNow) {
      const job = await enqueueJob({ missionId: id, userId });
      if (!job.ok) {
        return NextResponse.json(
          { ok: false, error: job.error },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      queued: runNow,
      next_run_at,
      message: runNow
        ? "Mission queued. Cron/worker will execute even if you close the tab."
        : "Mission scheduled on server.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "queue failed" },
      { status: 500 }
    );
  }
}
