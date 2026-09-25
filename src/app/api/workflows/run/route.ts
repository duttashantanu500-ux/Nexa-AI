import { NextRequest, NextResponse } from "next/server";
import { runWorkflow } from "@/lib/workflowEngine";
import type { WorkflowStep } from "@/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const steps = (body.steps || []) as WorkflowStep[];
    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { ok: false, error: "At least one workflow step is required." },
        { status: 400 }
      );
    }
    const result = await runWorkflow({
      steps,
      simulate: Boolean(body.simulate),
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        error: err?.message || "Workflow failed",
        steps: [],
        output: "",
      },
      { status: 500 }
    );
  }
}
