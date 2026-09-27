import { NextRequest, NextResponse } from "next/server";
import { slackVerifyToken } from "@/lib/connectors/providers/slack";
import { resolveSlackToken, slackOAuthConfigured } from "@/lib/connectors/slackAuth";

export async function GET(req: NextRequest) {
  if (!slackOAuthConfigured()) {
    return NextResponse.json({
      configured: false,
      status: "unavailable",
      message: "Slack is not set up on this site yet.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return NextResponse.json({
      configured: true,
      status: "available",
      message: "Sign in, then connect your Slack workspace.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const resolved = await resolveSlackToken(userId);
  if (!resolved) {
    return NextResponse.json({
      configured: true,
      status: "available",
      message: "Connect your Slack workspace to use it in agents.",
      connectPath: `/api/oauth/slack/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  const verify = await slackVerifyToken(resolved.token);
  if (!verify.ok) {
    return NextResponse.json({
      configured: true,
      status: "error",
      message: "Your Slack connection needs to be refreshed.",
      connectPath: `/api/oauth/slack/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: resolved.meta.workspaceName || null,
      canDisconnect: true,
    });
  }

  return NextResponse.json({
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
