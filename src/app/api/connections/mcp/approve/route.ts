import { NextRequest, NextResponse } from "next/server";
import { approveMcpTools } from "@/lib/connectors/mcpAuth";
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

    const tools = Array.isArray(body.tools)
      ? body.tools
          .map((t: unknown) => String(t).slice(0, 200))
          .filter(Boolean)
          .slice(0, 100)
      : [];

    const result = await approveMcpTools(auth.userId, tools);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message });
    }

    return NextResponse.json({
      ok: true,
      message:
        tools.length === 0
          ? "No tools approved. Your AI employees will not use this MCP server."
          : `${tools.length} tool${tools.length === 1 ? "" : "s"} approved for your AI employees.`,
      approvedTools: tools,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not save tool approvals." },
      { status: 500 }
    );
  }
}
