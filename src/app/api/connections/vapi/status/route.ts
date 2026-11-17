import { NextRequest, NextResponse } from "next/server";
import { resolveVapiToken } from "@/lib/connectors/vapiAuth";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return NextResponse.json(
      {
        configured: true,
        status: "available",
        message: "Sign in, then connect your voice calling account.",
        canDisconnect: false,
        connectPath: "/connections/vapi/setup",
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const resolved = await resolveVapiToken(userId);
  if (!resolved) {
    return NextResponse.json(
      {
        configured: true,
        status: "available",
        message:
          "Connect your voice calling account to use assistants and calls with your AI employees.",
        canDisconnect: false,
        connectPath: "/connections/vapi/setup",
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  return NextResponse.json(
    {
      configured: true,
      status: "connected",
      message: "Your voice calling account is connected",
      canDisconnect: true,
      workspaceName: resolved.meta.workspaceName || "Voice",
      connectedAt: resolved.meta.connectedAt,
      lastVerifiedAt: resolved.meta.lastVerifiedAt,
      connectPath: "/connections/vapi/setup",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
