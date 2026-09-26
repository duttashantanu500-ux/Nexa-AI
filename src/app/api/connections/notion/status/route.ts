import { NextRequest, NextResponse } from "next/server";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";
import { notionAdminConfigured, resolveNotionToken } from "@/lib/connectors/notionAuth";

export async function GET(req: NextRequest) {
  if (!notionAdminConfigured()) {
    return NextResponse.json({
      configured: false,
      status: "unavailable",
      message: "Notion is not set up on this site yet.",
      connectPath: null,
      source: null,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  const resolved = await resolveNotionToken(userId);

  if (!resolved) {
    const canOauth = Boolean(
      process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET
    );
    return NextResponse.json({
      configured: true,
      status: "available",
      message: canOauth
        ? "You can connect your Notion account."
        : "Notion is not linked yet.",
      connectPath:
        canOauth && userId
          ? `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}`
          : null,
      workspaceName: null,
      source: null,
    });
  }

  const verify = await notionVerifyToken(resolved.token);
  if (!verify.ok) {
    return NextResponse.json({
      configured: true,
      status: "error",
      message:
        resolved.source === "internal"
          ? "The Notion key on the server is invalid. Update it in Vercel."
          : "Notion link is broken. Try connecting again.",
      connectPath: null,
      workspaceName: resolved.meta?.workspaceName || null,
      source: resolved.source,
    });
  }

  return NextResponse.json({
    configured: true,
    status: "connected",
    message:
      resolved.source === "internal"
        ? "Ready — linked with your Notion workspace key"
        : "Ready — your Notion account is linked",
    connectPath: null,
    workspaceName:
      resolved.source === "internal"
        ? "Your Notion workspace"
        : resolved.meta?.workspaceName || "Notion",
    source: resolved.source,
    canDisconnect: resolved.source === "oauth",
    connectedAt: resolved.meta?.connectedAt,
    lastVerifiedAt: resolved.meta?.lastVerifiedAt,
  });
}
