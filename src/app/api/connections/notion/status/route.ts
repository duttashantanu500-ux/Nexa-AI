import { NextRequest, NextResponse } from "next/server";
import { notionOAuthConfigured, resolveNotionToken } from "@/lib/connectors/notionAuth";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

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

  const resolved = await resolveNotionToken(userId);
  if (!resolved) {
    return json({
      configured: true,
      status: "available",
      message: "Connect Notion to use it with your AI employees.",
      connectPath: `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}`,
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
    message: `Your Notion account is connected`,
    connectPath: null,
    workspaceName: workspace,
    canDisconnect: true,
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
