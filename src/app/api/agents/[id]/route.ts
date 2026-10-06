import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import {
  archiveAgentForUser,
  getAgentForUser,
  setAgentStatusForUser,
  upsertServerAgent,
} from "@/lib/serverAgents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const agent = await getAgentForUser(id, auth.userId);
  if (!agent) return json({ ok: false, message: "Employee not found." }, 404);
  return json({
    ok: true,
    agent: {
      id: agent.id,
      userId: agent.owner_user_id,
      name: agent.name,
      description: agent.description || "",
      purpose: agent.description || "",
      status: agent.status,
      version: agent.current_version || 1,
      steps: agent.steps || [],
      schedule: agent.schedule || null,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON." }, 400);
  }

  if (typeof body.status === "string" && !body.steps && !body.name) {
    const ok = await setAgentStatusForUser(id, auth.userId, body.status);
    return json(ok ? { ok: true } : { ok: false, message: "Could not update status." }, ok ? 200 : 404);
  }

  const existing = await getAgentForUser(id, auth.userId);
  if (!existing) return json({ ok: false, message: "Employee not found." }, 404);

  const result = await upsertServerAgent({
    userId: auth.userId,
    agentId: id,
    name: body.name ? String(body.name) : existing.name,
    description: body.description != null ? String(body.description) : existing.description,
    purpose: body.purpose != null ? String(body.purpose) : existing.description,
    status: body.status ? String(body.status) : existing.status,
    steps: Array.isArray(body.steps) ? body.steps : existing.steps || [],
    schedule: body.schedule && typeof body.schedule === "object" ? body.schedule : undefined,
  });

  if (!result.ok) return json({ ok: false, message: result.error }, 400);
  return json({ ok: true, id: result.id, version: result.version });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const ok = await archiveAgentForUser(id, auth.userId);
  return json(ok ? { ok: true } : { ok: false, message: "Could not delete employee." }, ok ? 200 : 404);
}
