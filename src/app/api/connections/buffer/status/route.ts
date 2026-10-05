import { NextRequest, NextResponse } from "next/server";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
import { bufferVerifyToken } from "@/lib/connectors/providers/buffer";
import { bufferOAuthConfigured, resolveBufferToken } from "@/lib/connectors/bufferAuth";

export async function GET(req: NextRequest) {
  if (!bufferOAuthConfigured()) {
    return json({
      configured: false,
      status: "unavailable",
      message: "Buffer is not set up on this site yet.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return json({
      configured: true,
      status: "available",
      message: "Sign in, then connect your Buffer account.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const resolved = await resolveBufferToken(userId);
  if (!resolved) {
    return json({
      configured: true,
      status: "available",
      message: "Connect your Buffer account to use it with your AI employees.",
      connectPath: `/api/oauth/buffer/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  const verify = await bufferVerifyToken(resolved.token);
  if (!verify.ok) {
    return json({
      configured: true,
      status: "error",
      message: "Your Buffer connection needs to be refreshed.",
      connectPath: `/api/oauth/buffer/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: resolved.meta.workspaceName || null,
      canDisconnect: true,
    });
  }

  return json({
    configured: true,
    status: "connected",
    message: "Your Buffer account is connected",
    connectPath: null,
    workspaceName: resolved.meta.workspaceName || null,
    canDisconnect: true,
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
