import { NextRequest, NextResponse } from "next/server";
import { getMcpConnection } from "@/lib/connectors/mcpAuth";
import { requireAuthUser } from "@/lib/apiAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Unauthenticated: only generic availability (no user data)
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({
        status: "available",
        message: "Sign in to connect your own custom tools server.",
      });
    }

    const auth = await requireAuthUser(req);
    if ("error" in auth) {
      return NextResponse.json({
        status: "available",
        message: "Sign in to connect your own custom tools server.",
      });
    }

    // Ignore client-supplied userId — always use JWT subject
    const conn = await getMcpConnection(auth.userId);
    if (!conn) {
      return NextResponse.json({
        status: "available",
        message: "Add your own tools server so AI employees can use approved tools.",
      });
    }

    return NextResponse.json({
      status: "connected",
      message:
        conn.approvedTools.length > 0
          ? `${conn.approvedTools.length} approved tool${conn.approvedTools.length === 1 ? "" : "s"}`
          : "Connected — review and approve tools for your AI employees.",
      label: conn.label,
      endpointHost: safeHost(conn.endpoint),
      discoveredTools: conn.discoveredTools.map((t) => ({
        name: t.name,
        description: (t.description || "").slice(0, 500),
      })),
      approvedTools: conn.approvedTools,
    });
  } catch {
    return NextResponse.json({
      status: "error",
      message: "Could not load custom tools connection.",
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
