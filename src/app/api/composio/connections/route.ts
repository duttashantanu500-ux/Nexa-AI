import { NextRequest, NextResponse } from "next/server";
import {
  countActiveConnections,
  listUserAccounts,
} from "@/lib/composio/accounts";
import { composioConfigured, composioUserId } from "@/lib/composio/client";
import { MAX_COMPOSIO_CONNECTIONS } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/composio/connections?userId= */
export async function GET(req: NextRequest) {
  if (!composioConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      accounts: [],
      used: 0,
      limit: MAX_COMPOSIO_CONNECTIONS,
      error: "Composio is not configured.",
    });
  }

  const userId = composioUserId(
    req.nextUrl.searchParams.get("userId") || ""
  );
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Sign in required.", accounts: [] },
      { status: 401 }
    );
  }

  try {
    const accounts = await listUserAccounts(userId);
    const used = await countActiveConnections(userId);
    return NextResponse.json({
      ok: true,
      configured: true,
      accounts,
      used,
      limit: MAX_COMPOSIO_CONNECTIONS,
      remaining: Math.max(0, MAX_COMPOSIO_CONNECTIONS - used),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        accounts: [],
        error: e?.message || "Failed to list connections",
      },
      { status: 500 }
    );
  }
}
