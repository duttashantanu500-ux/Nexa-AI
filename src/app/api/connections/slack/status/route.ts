import { NextRequest, NextResponse } from "next/server";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
import { slackVerifyToken } from "@/lib/connectors/providers/slack";
import { slackOAuthConfigured, resolveSlackToken } from "@/lib/connectors/slackAuth";

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
      message: "Sign in, then connect your Slack workspace.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const resolved = await resolveSlackToken(userId);
  if (!resolved) {
    return json({
      configured: true,
      status: "available",
      message: "Connect your Slack workspace to use it with your AI employees.",
      connectPath: `/api/oauth/slack/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  const verify = await slackVerifyToken(resolved.token);
  if (!verify.ok) {
    return json({
      configured: true,
      status: "error",
      message: "Your Slack connection needs to be refreshed.",
      connectPath: `/api/oauth/slack/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: resolved.meta.workspaceName || null,
      canDisconnect: true,
    });
  }

  return json({
    configured: true,
    status: "connected",
    message: "Your Slack workspace is connected",
    connectPath: null,
    workspaceName: resolved.meta.workspaceName || null,
    canDisconnect: true,
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
