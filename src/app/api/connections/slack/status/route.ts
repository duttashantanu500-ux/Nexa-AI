import { NextRequest, NextResponse } from "next/server";
import { slackOAuthConfigured, resolveSlackToken } from "@/lib/connectors/slackAuth";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

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

  const resolved = await resolveSlackToken(userId);
  if (!resolved) {
    return json({
      configured: true,
      status: "available",
      message: "Connect Slack to use it with your AI employees.",
      connectPath: `/api/oauth/slack/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  const workspace =
    (resolved.meta as { workspaceName?: string; teamName?: string })?.workspaceName ||
    (resolved.meta as { teamName?: string })?.teamName ||
    null;

  return json({
    configured: true,
    status: "connected",
    message: `Your Slack account is connected`,
    connectPath: null,
    workspaceName: workspace,
    canDisconnect: true,
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
