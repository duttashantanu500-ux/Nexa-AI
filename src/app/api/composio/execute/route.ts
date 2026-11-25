import { NextRequest, NextResponse } from "next/server";
import { listUserAccounts } from "@/lib/composio/accounts";
import {
  composioConfigured,
  composioUserId,
  executeComposioTool,
} from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/composio/execute */
export async function POST(req: NextRequest) {
  if (!composioConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "App connections aren’t available right now. Please try again later.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = composioUserId(String(body.userId || ""));
    const toolSlug = String(body.toolSlug || body.tool || "").trim();
    const args =
      body.arguments && typeof body.arguments === "object"
        ? body.arguments
        : {};
    const connectedAccountId = body.connectedAccountId
      ? String(body.connectedAccountId)
      : undefined;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sign in required." },
        { status: 401 }
      );
    }
    if (!toolSlug) {
      return NextResponse.json(
        { ok: false, error: "Choose an action to run." },
        { status: 400 }
      );
    }

    const accounts = await listUserAccounts(userId);
    const active = accounts.filter((a) =>
      /ACTIVE|CONNECTED|SUCCESS/i.test(a.status)
    );
    if (!active.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No connected apps. Open Connections and connect an account first.",
        },
        { status: 403 }
      );
    }

    if (connectedAccountId) {
      const owned = active.find((a) => a.id === connectedAccountId);
      if (!owned) {
        return NextResponse.json(
          {
            ok: false,
            error: "That connection is not available on your account.",
          },
          { status: 403 }
        );
      }
    }

    const result = await executeComposioTool({
      toolSlug,
      userId,
      arguments: args,
      connectedAccountId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || "Tool execution failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, result: result.data });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Tool execution failed" },
      { status: 500 }
    );
  }
}
