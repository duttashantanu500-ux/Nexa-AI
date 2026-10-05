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
      message: "Sign in to connect Buffer.",
      connectPath: null,
    });
  }

  if (!process.env.BUFFER_CLIENT_ID || !process.env.BUFFER_CLIENT_SECRET) {
    return json({
      ok: true,
      status: "available",
      message: "Buffer is not configured on this server yet.",
      connectPath: null,
    });
  }

  const conn = await getConnection(userId, "buffer");
  if (!conn?.accessToken) {
    return json({
      ok: true,
      status: "available",
      message: "Connect your Buffer account.",
      connectPath: `/api/oauth/buffer?userId=${encodeURIComponent(userId)}`,
    });
  }

  if (!conn.accessToken) {
    return json({
      ok: true,
      status: "error",
      message: "Buffer token is missing. Please reconnect.",
      connectPath: `/api/oauth/buffer?userId=${encodeURIComponent(userId)}`,
    });
  }

  return json({
    ok: true,
    status: "connected",
    message: "Buffer is connected.",
    workspaceName: conn.workspaceName || null,
    connectPath: null,
  });
}
