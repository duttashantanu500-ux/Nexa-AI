import { NextRequest, NextResponse } from "next/server";
import { discoverMcpTools } from "@/lib/mcp/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const endpoint = String(body.endpoint || "").trim();
    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "endpoint required" }, { status: 400 });
    }

    // Never accept long-lived secrets in body for storage — optional one-shot auth header only
    const authHeader =
      typeof body.authorization === "string" && body.authorization.length < 500
        ? body.authorization
        : undefined;

    const result = await discoverMcpTools(endpoint, authHeader);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || "Connection failed",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      tools: result.tools || [],
      serverInfo: result.serverInfo,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Discover failed" },
      { status: 500 }
    );
  }
}
