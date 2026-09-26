import { NextRequest, NextResponse } from "next/server";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";
import { notionAdminConfigured, resolveNotionToken } from "@/lib/connectors/notionAuth";

export async function GET(req: NextRequest) {
  if (!notionAdminConfigured()) {
    return NextResponse.json({
      configured: false,
      status: "unavailable",
      message:
        "Set NOTION_INTERNAL_TOKEN (simple) or NOTION_CLIENT_ID + NOTION_CLIENT_SECRET (OAuth) in Vercel.",
      connectPath: null,
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
        ? "Notion is ready to connect."
        : "Internal token missing or invalid.",
      connectPath:
        canOauth && userId
          ? `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}`
          : null,
      workspaceName: null,
    });
  }

  const verify = await notionVerifyToken(resolved.token);
  if (!verify.ok) {
    return NextResponse.json({
      configured: true,
      status: "error",
      message:
        verify.message ||
        (resolved.source === "internal"
          ? "Internal Notion token is invalid. Check NOTION_INTERNAL_TOKEN."
          : "Notion connection is invalid or revoked."),
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
        ? "Connected (internal integration token)"
        : "Connected",
    connectPath: null,
    workspaceName:
      resolved.meta?.workspaceName ||
      (typeof verify.data === "object" && verify.data && "name" in verify.data
        ? String((verify.data as { name?: string }).name || "")
        : null),
    source: resolved.source,
    connectedAt: resolved.meta?.connectedAt,
    lastVerifiedAt: resolved.meta?.lastVerifiedAt,
  });
}
