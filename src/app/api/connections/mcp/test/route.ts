import { NextRequest, NextResponse } from "next/server";
import { testMcpConnection } from "@/lib/connectors/mcpAuth";

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
    const result = await testMcpConnection(userId);
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
