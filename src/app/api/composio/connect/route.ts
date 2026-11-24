import { NextRequest, NextResponse } from "next/server";
import { assertCanAddConnection } from "@/lib/composio/accounts";
import {
  composioConfigured,
  composioUserId,
  getComposio,
} from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/composio/connect
 * body: { userId, toolkit }
 * Starts Composio authorize / Connect Link. Enforces max 3 accounts.
 */
export async function POST(req: NextRequest) {
  if (!composioConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Composio is not configured. Set COMPOSIO_API_KEY on the server.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = composioUserId(String(body.userId || ""));
    const toolkit = String(body.toolkit || body.slug || "")
      .trim()
      .toLowerCase();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sign in required." },
        { status: 401 }
      );
    }
    if (!toolkit) {
      return NextResponse.json(
        { ok: false, error: "Choose an integration to connect." },
        { status: 400 }
      );
    }

    const gate = await assertCanAddConnection(userId);
    if (!gate.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: gate.message,
          used: gate.used,
          limit: 3,
        },
        { status: 403 }
      );
    }

    const composio = getComposio();
    // Preferred: toolkit.authorize creates managed auth + connection request
    const connectionRequest = await composio.toolkits.authorize(userId, toolkit);

    const redirectUrl =
      (connectionRequest as any)?.redirectUrl ||
      (connectionRequest as any)?.redirect_url ||
      (connectionRequest as any)?.url ||
      null;

    return NextResponse.json({
      ok: true,
      redirectUrl,
      connectionRequestId:
        (connectionRequest as any)?.id ||
        (connectionRequest as any)?.connectionId ||
        null,
      used: gate.used,
      remaining: 3 - gate.used,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Could not start connection.",
      },
      { status: 500 }
    );
  }
}
