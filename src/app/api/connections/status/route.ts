import { NextRequest, NextResponse } from "next/server";
import { notionOAuthConfigured } from "@/lib/connectors/notionAuth";
import { slackOAuthConfigured } from "@/lib/connectors/slackAuth";
import { bufferOAuthConfigured } from "@/lib/connectors/bufferAuth";
import { hubspotOAuthConfigured } from "@/lib/connectors/hubspotAuth";
import { loadAllConnectionsForUser } from "@/lib/connectors/tokenStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

type StatusBody = {
  status: "connected" | "available" | "unavailable";
  message: string;
  canDisconnect: boolean;
  workspaceName?: string | null;
  connectedAt?: string;
  lastVerifiedAt?: string;
};

/**
 * Batch connection status from persisted tokens only.
 * Single DB round-trip — no remote provider health checks.
 * Source of truth for instant Connections UI.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";

  // One query for all connectors belonging to this user
  const all = userId ? await loadAllConnectionsForUser(userId) : new Map();

  const one = (
    label: string,
    connectorId: string,
    configured: boolean
  ): StatusBody => {
    if (!configured) {
      return {
        status: "unavailable",
        message: `${label} is not set up on this site yet.`,
        canDisconnect: false,
      };
    }
    if (!userId) {
      return {
        status: "available",
        message: "Sign in, then connect.",
        canDisconnect: false,
      };
    }
    const resolved = all.get(connectorId);
    if (!resolved?.accessToken) {
      return {
        status: "available",
        message: `Connect ${label} to use it with your AI employees.`,
        canDisconnect: false,
      };
    }
    const workspace =
      (typeof resolved.workspaceName === "string" && resolved.workspaceName) ||
      null;
    return {
      status: "connected",
      message: `Your ${label} account is connected`,
      workspaceName: workspace,
      canDisconnect: true,
      connectedAt:
        typeof resolved.connectedAt === "string" ? resolved.connectedAt : undefined,
      lastVerifiedAt:
        typeof resolved.lastVerifiedAt === "string"
          ? resolved.lastVerifiedAt
          : undefined,
    };
  };

  const statuses = {
    notion: one("Notion", "notion", notionOAuthConfigured()),
    slack: one("Slack", "slack", slackOAuthConfigured()),
    buffer: one("Buffer", "buffer", bufferOAuthConfigured()),
    hubspot: one("HubSpot", "hubspot", hubspotOAuthConfigured()),
    ideogram: one("Ideogram", "ideogram", true),
    mcp: one("MCP", "mcp", true),
  };

  return json({
    ok: true,
    statuses,
  });
}
