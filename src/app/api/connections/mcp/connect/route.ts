import { NextRequest, NextResponse } from "next/server";
import { connectAndDiscover, getMcpConnection } from "@/lib/connectors/mcpAuth";
import { getBillingSnapshot, ensureFreeSubscription } from "@/lib/billing";
import { LIMIT_MESSAGES } from "@/lib/plans";
import { loadConnection } from "@/lib/connectors/tokenStore";
import {
  requireAuthUser,
  assertUserIdMatch,
  isSafeOutboundUrl,
} from "@/lib/apiAuth";

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
    const auth = await requireAuthUser(req);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const mismatch = assertUserIdMatch(
      auth.userId,
      typeof body.userId === "string" ? body.userId : undefined
    );
    if (mismatch) return mismatch;

    const userId = auth.userId;
    const endpointRaw = String(body.endpoint || "").trim();
    const authorization =
      typeof body.authorization === "string" ? body.authorization : undefined;
    const label = typeof body.label === "string" ? body.label.slice(0, 80) : undefined;

    if (!endpointRaw) {
      return NextResponse.json(
        { ok: false, message: "Enter your MCP server address." },
        { status: 400 }
      );
    }

    const safeUrl = isSafeOutboundUrl(endpointRaw);
    if (!safeUrl.ok) {
      return NextResponse.json(
        { ok: false, message: safeUrl.message },
        { status: 400 }
      );
    }

    const existing = await getMcpConnection(userId);
    if (!existing) {
      await ensureFreeSubscription(userId);
      const snap = await getBillingSnapshot(userId);
      if (snap.limits.maxConnections !== Number.POSITIVE_INFINITY) {
        const count = await countConnected(userId);
        if (count >= snap.limits.maxConnections) {
          return NextResponse.json(
            {
              ok: false,
              message: LIMIT_MESSAGES.connections,
              limitReached: true,
            },
            { status: 403 }
          );
        }
      }
    }

    const result = await connectAndDiscover({
      userId,
      endpoint: safeUrl.url,
      authorization,
      label,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message });
    }

    return NextResponse.json({
      ok: true,
      message: `Found ${result.tools.length} tool${result.tools.length === 1 ? "" : "s"}. Approve the ones your AI employees may use.`,
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
