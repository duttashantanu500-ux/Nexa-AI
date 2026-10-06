import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { getAgentForUser, listRunsForAgent } from "@/lib/serverAgents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const agent = await getAgentForUser(id, auth.userId);
  if (!agent) {
    return NextResponse.json(
      { ok: false, message: "Employee not found.", runs: [] },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  let runs: unknown[] = [];
  try {
    if (typeof listRunsForAgent === "function") {
      runs = await listRunsForAgent(id, auth.userId);
    }
  } catch {
    runs = [];
  }
  return NextResponse.json(
    { ok: true, runs },
    { headers: { "Cache-Control": "no-store" } }
  );
}
