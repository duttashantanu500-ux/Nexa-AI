import { NextRequest, NextResponse } from "next/server";
import { notionOAuthConfigured } from "@/lib/connectors/notionAuth";
import { getConnection } from "@/lib/connectors/tokenStore";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/** Token-only status — no remote health check. Matches batch status for speed + usage sync. */
export async function GET(req: NextRequest) {
  if (!notionOAuthConfigured()) {
    return json({
      configured: false,
      status: "unavailable",
      message: "Notion is not set up on this site yet.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return json({
      configured: true,
      status: "available",
      message: "Sign in, then connect your Notion account.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const conn = await getConnection(userId, "notion");
  if (!conn?.accessToken) {
    return json({
      configured: true,
      status: "available",
      message: "Connect Notion to use it with your AI employees.",
      connectPath: `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  return json({
    configured: true,
    status: "connected",
    message: `Your Notion account is connected`,
    connectPath: null,
    workspaceName: conn.workspaceName || null,
    canDisconnect: true,
    connectedAt: conn.connectedAt,
    lastVerifiedAt: conn.lastVerifiedAt,
  });
}
