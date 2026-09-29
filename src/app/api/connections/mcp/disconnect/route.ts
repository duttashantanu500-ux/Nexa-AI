import { NextRequest, NextResponse } from "next/server";
import { deleteMcpConnection } from "@/lib/connectors/mcpAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Please sign in first." },
        { status: 401 }
      );
    }
    await deleteMcpConnection(userId);
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
