import { NextRequest, NextResponse } from "next/server";
import { bufferOAuthConfigured } from "@/lib/connectors/bufferAuth";
import { getConnection } from "@/lib/connectors/tokenStore";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/**
 * Token-only status — no remote Buffer health check.
 * Matches batch /api/connections/status for instant UI + accurate usage counts.
 */
export async function GET(req: NextRequest) {
  if (!bufferOAuthConfigured()) {
    return json({
      configured: false,
      status: "unavailable",
      message: "Buffer is not set up on this site yet.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return json({
      configured: true,
      status: "available",
      message: "Sign in, then connect your Buffer account.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const conn = await getConnection(userId, "buffer");
  if (!conn?.accessToken) {
    return json({
      configured: true,
      status: "available",
      message: "Connect Buffer to use it with your AI employees.",
      connectPath: `/api/oauth/buffer/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  return json({
    configured: true,
    status: "connected",
    message: "Your Buffer account is connected",
    connectPath: null,
    workspaceName: conn.workspaceName || null,
    canDisconnect: true,
    connectedAt: conn.connectedAt,
    lastVerifiedAt: conn.lastVerifiedAt,
  });
}
