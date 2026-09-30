import { NextRequest, NextResponse } from "next/server";
import { testMcpConnection } from "@/lib/connectors/mcpAuth";
import { requireAuthUser, assertUserIdMatch } from "@/lib/apiAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const mismatch = assertUserIdMatch(
      auth.userId,
      typeof body.userId === "string" ? body.userId : undefined
    );
    if (mismatch) return mismatch;

    const result = await testMcpConnection(auth.userId);
    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      tools: result.tools,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not test connection." },
      { status: 500 }
    );
  }
}
