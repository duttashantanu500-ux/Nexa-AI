import { NextRequest, NextResponse } from "next/server";
import { buildPlan, executeResearchMission } from "@/lib/agentEngine";

/**
 * Vercel Cron entrypoint.
 * Note: Full multi-tenant schedule persistence requires a database.
 * This endpoint validates the cron secret and is ready to process
 * server-stored schedules when Supabase mission tables are wired.
 *
 * Without server-side schedule storage, it returns a clear status
 * rather than faking background work.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Placeholder: when missions are stored server-side, load due schedules here.
  // Client-side schedules still run when the user opens the app (see schedules UI).

  return NextResponse.json({
    ok: true,
    processed: 0,
    message:
      "Cron reachable. Server-side schedule queue not configured yet — schedules run when the user is online or when DB schedules are added.",
    at: new Date().toISOString(),
  });
}

/** Manual server-side run for a single goal (authenticated by presence of body) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const goal = String(body.goal || "").trim();
    if (!goal) {
      return NextResponse.json({ error: "goal required" }, { status: 400 });
    }

    const plan = body.plan || buildPlan(goal, body.businessContext || null);
    const result = await executeResearchMission({
      goal,
      business: body.businessContext || null,
      plan,
      maxPages: Math.min(Number(body.maxPages) || 6, 8),
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "run failed" },
      { status: 500 }
    );
  }
}
