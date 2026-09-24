import { NextRequest, NextResponse } from "next/server";
import { buildPlan } from "@/lib/agentEngine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const goal = String(body.goal || "").trim();
    if (!goal) {
      return NextResponse.json({ error: "Goal required" }, { status: 400 });
    }
    const plan = buildPlan(goal, body.businessContext || null);
    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Plan failed" },
      { status: 500 }
    );
  }
}
