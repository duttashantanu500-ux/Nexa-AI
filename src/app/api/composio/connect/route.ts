import { NextRequest, NextResponse } from "next/server";
import { assertCanAddConnection } from "@/lib/composio/accounts";
import {
  composioConfigured,
  composioUserId,
  getComposio,
} from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — start app connection. Enforces max 3 accounts. */
export async function POST(req: NextRequest) {
  if (!composioConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "App connections aren’t available right now. Please try again later.",
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
        { ok: false, error: "Choose an app to connect." },
        { status: 400 }
      );
    }

    const gate = await assertCanAddConnection(userId);
    if (!gate.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You’ve used all 3 connection slots. Disconnect an app to free one.",
          used: gate.used,
          limit: 3,
        },
        { status: 403 }
      );
    }

    const composio = getComposio();
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
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not start connection. Please try again.",
      },
      { status: 500 }
    );
  }
}
