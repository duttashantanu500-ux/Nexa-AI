import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import {
  listAgentsForUser,
  loadAgentSteps,
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

export async function GET(req: NextRequest) {
  const auth = await requireAuthUser(req);
  if ("error" in auth) return auth.error;

  try {
    const rows = await listAgentsForUser(auth.userId);
    const agents = await Promise.all(
      rows.map(async (a) => {
        const steps = await loadAgentSteps(a.id, a.current_version);
        return {
          id: a.id,
          userId: a.owner_user_id,
          name: a.name,
          description: a.description || "",
          purpose: a.description || "",
          status: a.status || "active",
          version: a.current_version || 1,
          steps,
          schedule: {
            frequency: "once",
            enabled: false,
          },
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        };
      })
    );
    return json({ ok: true, agents, serverConfigured: true });
  } catch (e) {
    console.error("[api/agents GET]", e);
    return json({ ok: false, agents: [], serverConfigured: true, message: "Could not load employees." }, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthUser(req);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON." }, 400);
  }

  const name = String(body.name || "").trim();
  if (!name) return json({ ok: false, message: "Name is required." }, 400);

  const result = await upsertServerAgent({
    userId: auth.userId,
    agentId: body.id ? String(body.id) : undefined,
    name,
    description: body.description ? String(body.description) : undefined,
    purpose: body.purpose ? String(body.purpose) : undefined,
    status: body.status ? String(body.status) : "active",
    steps: Array.isArray(body.steps) ? body.steps : [],
    schedule: body.schedule && typeof body.schedule === "object" ? body.schedule : undefined,
  });

  if (!result.ok) {
    return json({ ok: false, message: result.error }, 400);
  }
  return json({ ok: true, id: result.id, version: result.version });
}
