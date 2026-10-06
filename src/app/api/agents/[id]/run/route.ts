import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { getAgentForUser } from "@/lib/serverAgents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server run endpoint — marks intent; actual connector execution is driven
 * by the client workflow engine with live tokens. Never fakes success.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const agent = await getAgentForUser(id, auth.userId);
  if (!agent) {
    return NextResponse.json(
      { ok: false, message: "Employee not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (agent.status === "paused" || agent.status === "archived") {
    return NextResponse.json(
      { ok: false, message: "This employee is paused or archived." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    {
      ok: true,
      agentId: id,
      message: "Run authorized. Execute steps with live connectors on the client.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
