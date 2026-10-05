import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import {
  loadEmployeeChat,
  saveEmployeeChat,
  migrateEmployeeChatScope,
} from "@/lib/employeeChatServer";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuthUser(req);
  if ("error" in auth) return auth.error;

  const scopeId = req.nextUrl.searchParams.get("scopeId")?.trim() || "";
  if (!scopeId) {
    return NextResponse.json({ ok: false, message: "Missing conversation." }, { status: 400 });
  }
  const messages = await loadEmployeeChat(auth.userId, scopeId);
  return NextResponse.json({ ok: true, messages, server: true });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthUser(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const scopeId = String(body.scopeId || "").trim();

  if (body.migrateFrom && body.migrateTo) {
    const ok = await migrateEmployeeChatScope({
      userId: auth.userId,
      fromScope: String(body.migrateFrom),
      toScope: String(body.migrateTo),
      agentId: body.agentId ? String(body.agentId) : undefined,
    });
    return NextResponse.json({ ok });
  }

  if (!scopeId) {
    return NextResponse.json({ ok: false, message: "Missing conversation." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const result = await saveEmployeeChat({
    userId: auth.userId,
    scopeId,
    messages,
    agentId: body.agentId ? String(body.agentId) : null,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
