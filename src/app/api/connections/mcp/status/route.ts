import { NextRequest, NextResponse } from "next/server";
import { getMcpConnection } from "@/lib/connectors/mcpAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId") || "";
    if (!userId) {
      return NextResponse.json({
        status: "available",
        message: "Sign in to connect your own MCP server.",
      });
    }

    const conn = await getMcpConnection(userId);
    if (!conn) {
      return NextResponse.json({
        status: "available",
        message: "Add your own MCP server to use its tools in agents.",
      });
    }

    return NextResponse.json({
      status: "connected",
      message:
        conn.approvedTools.length > 0
          ? `${conn.approvedTools.length} approved tool${conn.approvedTools.length === 1 ? "" : "s"}`
          : "Connected — review and approve tools to use them in agents.",
      label: conn.label,
      endpointHost: safeHost(conn.endpoint),
      discoveredTools: conn.discoveredTools.map((t) => ({
        name: t.name,
        description: t.description || "",
      })),
      approvedTools: conn.approvedTools,
    });
  } catch {
    return NextResponse.json({
      status: "error",
      message: "Could not load MCP connection.",
    });
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
