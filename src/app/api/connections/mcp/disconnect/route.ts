import { NextRequest, NextResponse } from "next/server";
import { deleteMcpConnection } from "@/lib/connectors/mcpAuth";
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

    await deleteMcpConnection(auth.userId);
    return NextResponse.json({
      ok: true,
      message: "MCP server disconnected.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not disconnect." },
      { status: 500 }
    );
  }
}
