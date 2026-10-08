import { NextRequest, NextResponse } from "next/server";
import { slackOAuthConfigured } from "@/lib/connectors/slackAuth";
import { getConnection } from "@/lib/connectors/tokenStore";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/** Token-only status — no remote health check. Matches batch status for speed + usage sync. */
export async function GET(req: NextRequest) {
  if (!slackOAuthConfigured()) {
    return json({
      configured: false,
      status: "unavailable",
      message: "Slack is not set up on this site yet.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return json({
      configured: true,
      status: "available",
      message: "Sign in, then connect your Slack account.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const conn = await getConnection(userId, "slack");
  if (!conn?.accessToken) {
    return json({
      configured: true,
      status: "available",
      message: "Connect Slack to use it with your AI employees.",
      connectPath: `/api/oauth/slack/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  return json({
    configured: true,
    status: "connected",
    message: `Your Slack account is connected`,
    connectPath: null,
    workspaceName: conn.workspaceName || null,
    canDisconnect: true,
    connectedAt: conn.connectedAt,
    lastVerifiedAt: conn.lastVerifiedAt,
  });
}
