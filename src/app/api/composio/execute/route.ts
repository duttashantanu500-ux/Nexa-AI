import { NextRequest, NextResponse } from "next/server";
import { listUserAccounts } from "@/lib/composio/accounts";
import {
  composioConfigured,
  composioUserId,
  getComposio,
} from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/composio/execute
 * body: { userId, toolSlug, arguments?, connectedAccountId? }
 * Never simulates success — returns Composio result or error as-is.
 */
export async function POST(req: NextRequest) {
  if (!composioConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Composio is not configured." },
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
        { ok: false, error: "toolSlug is required." },
        { status: 400 }
      );
    }

    // Require at least one active connection for this user
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
          { ok: false, error: "That connection is not available on your account." },
          { status: 403 }
        );
      }
    }

    const composio = getComposio();
    const result = await composio.tools.execute(toolSlug, {
      userId,
      arguments: args,
      ...(connectedAccountId ? { connectedAccountId } : {}),
      // Prefer explicit version when callers pass it; otherwise skip version check for managed tools
      ...(body.version
        ? { version: String(body.version) }
        : { dangerouslySkipVersionCheck: true }),
    } as any);

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Tool execution failed",
      },
      { status: 500 }
    );
  }
}
