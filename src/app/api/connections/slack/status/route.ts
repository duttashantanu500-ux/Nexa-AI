import { NextRequest, NextResponse } from "next/server";
import { slackVerifyToken } from "@/lib/connectors/providers/slack";
import { slackOAuthConfigured, resolveSlackToken } from "@/lib/connectors/slackAuth";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(req: NextRequest) {
  if (!slackOAuthConfigured()) {
    return json({
      configured: false,
      status: "unavailable",
      message: "Slack is not set up on this site yet.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return json({
      configured: true,
      status: "available",
      message: "Sign in, then connect your Slack workspace.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const resolved = await resolveSlackToken(userId);
  if (!resolved) {
    return json({
      configured: true,
      status: "available",
      message: "Connect your Slack workspace to use it with your AI employees.",
      connectPath: `/api/oauth/slack/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  // Token present → Connected immediately; optional 2s verify
  let status: "connected" | "error" = "connected";
  let message = "Your Slack workspace is connected";
  try {
    const verifyPromise = slackVerifyToken(resolved.token);
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
      message = "Your Slack connection needs to be refreshed.";
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
        ? `/api/oauth/slack/start?userId=${encodeURIComponent(userId)}`
        : null,
    workspaceName: resolved.meta.workspaceName || null,
    canDisconnect: true,
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
