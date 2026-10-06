import { NextRequest, NextResponse } from "next/server";
import { resolveIdeogramToken } from "@/lib/connectors/ideogramAuth";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return NextResponse.json(
      {
        configured: true,
        status: "available",
        message: "Sign in, then connect your Ideogram account.",
        canDisconnect: false,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const resolved = await resolveIdeogramToken(userId);
  if (!resolved) {
    return NextResponse.json(
      {
        configured: true,
        status: "available",
        message: "Connect your Ideogram account to create images with your AI employees.",
        canDisconnect: false,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  return NextResponse.json(
    {
      configured: true,
      status: "connected",
      message: "Your Ideogram account is connected",
      canDisconnect: true,
      workspaceName: resolved.meta.workspaceName || "Ideogram",
      connectedAt: resolved.meta.connectedAt,
      lastVerifiedAt: resolved.meta.lastVerifiedAt,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
