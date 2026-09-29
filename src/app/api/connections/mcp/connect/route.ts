import { NextRequest, NextResponse } from "next/server";
import { connectAndDiscover } from "@/lib/connectors/mcpAuth";
import { getBillingSnapshot, ensureFreeSubscription } from "@/lib/billing";
import { LIMIT_MESSAGES } from "@/lib/plans";
import { getMcpConnection } from "@/lib/connectors/mcpAuth";
import { loadConnection } from "@/lib/connectors/tokenStore";

export const runtime = "nodejs";

const EXTERNAL = ["notion", "slack", "buffer", "ideogram", "mcp"] as const;

async function countConnected(userId: string): Promise<number> {
  let n = 0;
  for (const id of EXTERNAL) {
    if (id === "mcp") {
      if (await getMcpConnection(userId)) n += 1;
    } else {
      const c = await loadConnection(userId, id);
      if (c) n += 1;
    }
  }
  return n;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    const endpoint = String(body.endpoint || "").trim();
    const authorization =
      typeof body.authorization === "string" ? body.authorization : undefined;
    const label = typeof body.label === "string" ? body.label : undefined;

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Please sign in first." },
        { status: 401 }
      );
    }
    if (!endpoint) {
      return NextResponse.json(
        { ok: false, message: "Enter your MCP server address." },
        { status: 400 }
      );
    }

    // Connection limit (Free: 3) — only if not already connected
    const existing = await getMcpConnection(userId);
    if (!existing) {
      await ensureFreeSubscription(userId);
      const snap = await getBillingSnapshot(userId);
      if (
        snap.limits.maxConnections !== Number.POSITIVE_INFINITY
      ) {
        const count = await countConnected(userId);
        if (count >= snap.limits.maxConnections) {
          return NextResponse.json(
            { ok: false, message: LIMIT_MESSAGES.connections, limitReached: true },
            { status: 403 }
          );
        }
      }
    }

    const result = await connectAndDiscover({
      userId,
      endpoint,
      authorization,
      label,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message });
    }

    return NextResponse.json({
      ok: true,
      message: `Found ${result.tools.length} tool${result.tools.length === 1 ? "" : "s"}. Approve the ones agents may use.`,
      tools: result.tools,
      serverName: result.serverName,
    });
  } catch (e) {
    console.error("mcp/connect", e);
    return NextResponse.json(
      { ok: false, message: "Could not connect. Please try again." },
      { status: 500 }
    );
  }
}
