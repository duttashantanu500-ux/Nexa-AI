import { NextRequest, NextResponse } from "next/server";
import { bufferVerifyToken } from "@/lib/connectors/providers/buffer";
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
      message: "Connect your Buffer account to use it with your AI employees.",
      connectPath: `/api/oauth/buffer/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  let status: "connected" | "error" = "connected";
  let message = "Your Buffer account is connected";
  try {
    const verifyPromise = bufferVerifyToken(resolved.token);
    const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 2000));
    const raced = await Promise.race([verifyPromise, timeout]);
    if (
      raced !== "timeout" &&
      raced &&
      typeof raced === "object" &&
      "ok" in raced &&
      !(raced as { ok: boolean }).ok
    ) {
      status = "error";
      message = "Your Buffer connection needs to be refreshed.";
    }
  } catch {
    /* keep connected */
  }

  return json({
    configured: true,
    status,
    message,
    connectPath:
      status === "error"
        ? `/api/oauth/buffer/start?userId=${encodeURIComponent(userId)}`
        : null,
    workspaceName: resolved.meta.workspaceName || null,
    canDisconnect: true,
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
