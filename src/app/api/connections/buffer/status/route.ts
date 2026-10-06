import { NextRequest, NextResponse } from "next/server";
import { bufferOAuthConfigured, resolveBufferToken } from "@/lib/connectors/bufferAuth";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

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
      message: "Connect Buffer to use it with your AI employees.",
      connectPath: `/api/oauth/buffer/start?userId=${encodeURIComponent(userId)}`,
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
    message: `Your Buffer account is connected`,
    connectPath: null,
    workspaceName: workspace,
    canDisconnect: true,
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
