import { NextRequest, NextResponse } from "next/server";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
import { getConnection } from "@/lib/connectors/tokenStore";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return json({
      ok: true,
      status: "unavailable",
      message: "Sign in to connect Slack.",
      connectPath: null,
    });
  }

  if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) {
    return json({
      ok: true,
      status: "available",
      message: "Slack is not configured on this server yet.",
      connectPath: null,
    });
  }

  const conn = await getConnection(userId, "slack");
  if (!conn?.accessToken) {
    return json({
      ok: true,
      status: "available",
      message: "Connect your Slack workspace.",
      connectPath: `/api/oauth/slack?userId=${encodeURIComponent(userId)}`,
    });
  }

  if (!conn.accessToken) {
    return json({
      ok: true,
      status: "error",
      message: "Slack token is missing. Please reconnect.",
      connectPath: `/api/oauth/slack?userId=${encodeURIComponent(userId)}`,
    });
  }

  return json({
    ok: true,
    status: "connected",
    message: "Slack is connected.",
    workspaceName: conn.workspaceName || null,
    connectPath: null,
  });
}
