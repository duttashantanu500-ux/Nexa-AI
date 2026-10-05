import { NextRequest, NextResponse } from "next/server";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";
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
      message: "Notion is not set up for user sign-in yet.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return json({
      configured: true,
      status: "available",
      message: "Sign in, then connect your own Notion account.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const resolved = await resolveNotionToken(userId);
  if (!resolved) {
    return json({
      configured: true,
      status: "available",
      message: "Connect your Notion account to use it with your AI employees.",
      connectPath: `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  let status: "connected" | "error" = "connected";
  let message = "Your Notion account is connected";
  try {
    const verifyPromise = notionVerifyToken(resolved.token);
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
      message = "Your Notion link expired or was revoked. Connect again.";
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
        ? `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}`
        : null,
    workspaceName: resolved.meta.workspaceName || "Notion",
    source: "oauth",
    canDisconnect: true,
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
