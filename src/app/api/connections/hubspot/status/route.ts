import { NextRequest, NextResponse } from "next/server";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
import { hubspotVerifyToken } from "@/lib/connectors/providers/hubspot";
import {
  hubspotOAuthConfigured,
  resolveHubspotToken,
} from "@/lib/connectors/hubspotAuth";

export async function GET(req: NextRequest) {
  if (!hubspotOAuthConfigured()) {
    return json({
      configured: false,
      status: "unavailable",
      message: "HubSpot is not set up on this site yet.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return json({
      configured: true,
      status: "available",
      message: "Sign in, then connect your HubSpot account.",
      connectPath: null,
      canDisconnect: false,
    });
  }

  const resolved = await resolveHubspotToken(userId);
  if (!resolved) {
    return json({
      configured: true,
      status: "available",
      message: "Connect your HubSpot account to use it with your AI employees.",
      connectPath: `/api/oauth/hubspot/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: null,
      canDisconnect: false,
    });
  }

  const verify = await hubspotVerifyToken(resolved.token);
  if (!verify.ok) {
    return json({
      configured: true,
      status: "error",
      message: "Your HubSpot connection needs to be refreshed.",
      connectPath: `/api/oauth/hubspot/start?userId=${encodeURIComponent(userId)}`,
      workspaceName: resolved.meta.workspaceName || null,
      canDisconnect: true,
    });
  }

  return json({
    configured: true,
    status: "connected",
    message: "Your HubSpot account is connected",
    connectPath: null,
    workspaceName: resolved.meta.workspaceName || null,
    canDisconnect: true,
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
