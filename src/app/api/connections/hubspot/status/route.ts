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
      message: "Sign in to connect HubSpot.",
      connectPath: null,
    });
  }

  if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET) {
    return json({
      ok: true,
      status: "available",
      message: "HubSpot is not configured on this server yet.",
      connectPath: null,
    });
  }

  const conn = await getConnection(userId, "hubspot");
  if (!conn?.accessToken) {
    return json({
      ok: true,
      status: "available",
      message: "Connect your HubSpot account to manage CRM data.",
      connectPath: `/api/oauth/hubspot?userId=${encodeURIComponent(userId)}`,
    });
  }

  if (!conn.accessToken.startsWith("pat-") && !conn.accessToken.includes(".")) {
    // keep connected if token present; soft warn only via message if needed
  }

  if (!conn.accessToken) {
    return json({
      ok: true,
      status: "error",
      message: "HubSpot token is missing. Please reconnect.",
      connectPath: `/api/oauth/hubspot?userId=${encodeURIComponent(userId)}`,
    });
  }

  return json({
    ok: true,
    status: "connected",
    message: "HubSpot is connected.",
    workspaceName: conn.workspaceName || null,
    connectPath: null,
  });
}
