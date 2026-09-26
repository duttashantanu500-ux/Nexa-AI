import { NextRequest, NextResponse } from "next/server";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";
import { notionOAuthConfigured, resolveNotionToken } from "@/lib/connectors/notionAuth";

export async function GET(req: NextRequest) {
  if (!notionOAuthConfigured()) {
    return NextResponse.json({
      configured: false,
      status: "unavailable",
      message:
        "Notion is not set up for user sign-in yet. Admin must add NOTION_CLIENT_ID and NOTION_CLIENT_SECRET (public Notion integration).",
      connectPath: null,
      source: null,
      canDisconnect: false,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return NextResponse.json({
      configured: true,
      status: "available",
      message: "Sign in, then connect your own Notion account.",
      connectPath: null,
      source: null,
      canDisconnect: false,
    });
  }

  const resolved = await resolveNotionToken(userId);

  if (!resolved) {
    return NextResponse.json({
      configured: true,
      status: "available",
      message: "Connect your Notion account to use it in agents.",
      connectPath: `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      source: null,
      canDisconnect: false,
    });
  }

  const verify = await notionVerifyToken(resolved.token);
  if (!verify.ok) {
    return NextResponse.json({
      configured: true,
      status: "error",
      message: "Your Notion link expired or was revoked. Connect again.",
      connectPath: `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: resolved.meta.workspaceName || null,
      source: "oauth",
      canDisconnect: true,
    });
  }

  return NextResponse.json({
    configured: true,
    status: "connected",
    message: "Your Notion account is connected",
    connectPath: null,
    workspaceName: resolved.meta.workspaceName || "Notion",
    source: "oauth",
    canDisconnect: true,
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
