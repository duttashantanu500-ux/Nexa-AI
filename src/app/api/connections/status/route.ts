import { NextRequest, NextResponse } from "next/server";
import { notionOAuthConfigured, resolveNotionToken } from "@/lib/connectors/notionAuth";
import { slackOAuthConfigured, resolveSlackToken } from "@/lib/connectors/slackAuth";
import { bufferOAuthConfigured, resolveBufferToken } from "@/lib/connectors/bufferAuth";
import { hubspotOAuthConfigured, resolveHubspotToken } from "@/lib/connectors/hubspotAuth";
import { resolveIdeogramToken } from "@/lib/connectors/ideogramAuth";
import { resolveMcpConnection } from "@/lib/connectors/mcpAuth";

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
 * No remote provider health checks — source of truth for instant UI.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";

  const one = async (
    label: string,
    configured: boolean,
    resolve: (uid: string) => Promise<{ meta?: Record<string, unknown> } | null>
  ): Promise<StatusBody> => {
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
    try {
      const resolved = await resolve(userId);
      if (!resolved) {
        return {
          status: "available",
          message: `Connect ${label} to use it with your AI employees.`,
          canDisconnect: false,
        };
      }
      const meta = (resolved.meta || {}) as Record<string, unknown>;
      const workspace =
        (typeof meta.workspaceName === "string" && meta.workspaceName) ||
        (typeof meta.teamName === "string" && meta.teamName) ||
        null;
      return {
        status: "connected",
        message: `Your ${label} account is connected`,
        workspaceName: workspace,
        canDisconnect: true,
        connectedAt: typeof meta.connectedAt === "string" ? meta.connectedAt : undefined,
        lastVerifiedAt:
          typeof meta.lastVerifiedAt === "string" ? meta.lastVerifiedAt : undefined,
      };
    } catch {
      return {
        status: "available",
        message: `Connect ${label} to use it with your AI employees.`,
        canDisconnect: false,
      };
    }
  };

  const [notion, slack, buffer, hubspot, ideogram, mcp] = await Promise.all([
    one("Notion", notionOAuthConfigured(), resolveNotionToken),
    one("Slack", slackOAuthConfigured(), resolveSlackToken),
    one("Buffer", bufferOAuthConfigured(), resolveBufferToken),
    one("HubSpot", hubspotOAuthConfigured(), resolveHubspotToken),
    one("Ideogram", true, resolveIdeogramToken),
    one("MCP", true, async (uid) => {
      const r = await resolveMcpConnection(uid);
      return r ? { meta: r.meta as unknown as Record<string, unknown> } : null;
    }),
  ]);

  return json({
    ok: true,
    statuses: { notion, slack, buffer, hubspot, ideogram, mcp },
  });
}
