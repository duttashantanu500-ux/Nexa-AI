import { NextRequest, NextResponse } from "next/server";
import { executeApprovedMcpTool } from "@/lib/connectors/mcpAuth";
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

    const toolName = String(body.toolName || body.actionId || "").trim();
    const args =
      body.args && typeof body.args === "object" && !Array.isArray(body.args)
        ? (body.args as Record<string, unknown>)
        : body.input && typeof body.input === "object" && !Array.isArray(body.input)
          ? (body.input as Record<string, unknown>)
          : {};

    if (!toolName) {
      return NextResponse.json(
        { ok: false, message: "Tool name is required." },
        { status: 400 }
      );
    }

    const name = toolName.startsWith("mcp.") ? toolName.slice(4) : toolName;

    const result = await executeApprovedMcpTool({
      userId: auth.userId,
      toolName: name.slice(0, 200),
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
