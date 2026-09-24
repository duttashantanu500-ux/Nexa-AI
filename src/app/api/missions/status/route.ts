import { NextRequest, NextResponse } from "next/server";
import { getMissionRow, hasServerMissions } from "@/lib/serverMissions";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  if (!hasServerMissions()) {
    return NextResponse.json({ ok: false, configured: false });
  }

  const row = await getMissionRow(id);
  if (!row) {
    return NextResponse.json({ ok: false, found: false });
  }

  return NextResponse.json({
    ok: true,
    found: true,
    mission: {
      id: row.id,
      status: row.status,
      progress: row.progress,
      activity: row.activity,
      plan: row.plan,
      deliverable: row.deliverable,
      result: row.result,
      error: row.error,
      next_run_at: row.next_run_at,
      last_run_at: row.last_run_at,
      updated_at: row.updated_at,
    },
  });
}
