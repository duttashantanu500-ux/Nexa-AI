import { NextRequest, NextResponse } from "next/server";
import { approveMcpTools } from "@/lib/connectors/mcpAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    const tools = Array.isArray(body.tools)
      ? body.tools.map((t: unknown) => String(t)).filter(Boolean)
      : [];

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Please sign in first." },
        { status: 401 }
      );
    }

    const result = await approveMcpTools(userId, tools);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message });
    }

    return NextResponse.json({
      ok: true,
      message:
        tools.length === 0
          ? "No tools approved. Agents will not use this MCP server."
          : `${tools.length} tool${tools.length === 1 ? "" : "s"} approved for your agents.`,
      approvedTools: tools,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not save tool approvals." },
      { status: 500 }
    );
  }
}
