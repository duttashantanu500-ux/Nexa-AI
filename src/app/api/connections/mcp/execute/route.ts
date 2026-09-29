import { NextRequest, NextResponse } from "next/server";
import { executeApprovedMcpTool } from "@/lib/connectors/mcpAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    const toolName = String(body.toolName || body.actionId || "").trim();
    const args =
      body.args && typeof body.args === "object"
        ? (body.args as Record<string, unknown>)
        : body.input && typeof body.input === "object"
          ? (body.input as Record<string, unknown>)
          : {};

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Please sign in first." },
        { status: 401 }
      );
    }
    if (!toolName) {
      return NextResponse.json(
        { ok: false, message: "Tool name is required." },
        { status: 400 }
      );
    }

    // Strip mcp. prefix if present
    const name = toolName.startsWith("mcp.") ? toolName.slice(4) : toolName;

    const result = await executeApprovedMcpTool({
      userId,
      toolName: name,
      args,
    });

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      data: result.data,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Tool could not be run." },
      { status: 500 }
    );
  }
}
