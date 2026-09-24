import { NextRequest, NextResponse } from "next/server";
import { buildPlan, executeResearchMission } from "@/lib/agentEngine";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const goal = String(body.goal || "").trim();
    if (!goal) {
      return NextResponse.json({ error: "Goal required" }, { status: 400 });
    }

    const plan =
      body.plan && Array.isArray(body.plan.steps)
        ? body.plan
        : buildPlan(goal, body.businessContext || null);

    const result = await executeResearchMission({
      goal,
      business: body.businessContext || null,
      plan,
      maxPages: Math.min(Number(body.maxPages) || 6, 8),
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        error: err?.message || "Execution failed",
        activity: [],
        progress: 0,
        steps: [],
      },
      { status: 500 }
    );
  }
}
