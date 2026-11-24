import { NextRequest, NextResponse } from "next/server";
import { listUserAccounts } from "@/lib/composio/accounts";
import {
  composioConfigured,
  composioUserId,
  getComposio,
} from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/composio/disconnect  body: { userId, connectedAccountId } */
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
    const connectedAccountId = String(
      body.connectedAccountId || body.id || ""
    ).trim();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sign in required." },
        { status: 401 }
      );
    }
    if (!connectedAccountId) {
      return NextResponse.json(
        { ok: false, error: "Missing connection id." },
        { status: 400 }
      );
    }

    // Ownership: account must belong to this user
    const accounts = await listUserAccounts(userId);
    const owned = accounts.find((a) => a.id === connectedAccountId);
    if (!owned) {
      return NextResponse.json(
        { ok: false, error: "Connection not found for this account." },
        { status: 404 }
      );
    }

    const composio = getComposio();
    await composio.connectedAccounts.delete(connectedAccountId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Could not disconnect." },
      { status: 500 }
    );
  }
}
