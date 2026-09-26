import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/connectors/tokenStore";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";

export async function GET(req: NextRequest) {
  const configured = Boolean(
    process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET
  );

  if (!configured) {
    return NextResponse.json({
      configured: false,
      status: "unavailable",
      message: "Administrator must set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET.",
      connectPath: null,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({
      configured: true,
      status: "available",
      message: "Sign in and open Connect to authorize Notion.",
      connectPath: null,
    });
  }

  const conn = await getConnection(userId, "notion");
  if (!conn) {
    return NextResponse.json({
      configured: true,
      status: "available",
      message: "Notion is ready to connect.",
      connectPath: `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
    });
  }

  const verify = await notionVerifyToken(conn.accessToken);
  if (!verify.ok) {
    return NextResponse.json({
      configured: true,
      status: "error",
      message: verify.message || "Notion connection is invalid or revoked.",
      connectPath: `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: conn.workspaceName || null,
    });
  }

  return NextResponse.json({
    configured: true,
    status: "connected",
    message: "Connected",
    connectPath: null,
    workspaceName: conn.workspaceName || null,
    connectedAt: conn.connectedAt,
    lastVerifiedAt: conn.lastVerifiedAt,
  });
}
