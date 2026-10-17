import { NextRequest, NextResponse } from "next/server";
import { resolveVapiToken } from "@/lib/connectors/vapiAuth";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return NextResponse.json(
      {
        configured: true,
        status: "available",
        message: "Sign in, then connect your Vapi account.",
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
          "Connect your own Vapi account to use voice assistants and calls with your AI employees.",
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
      message: "Your Vapi account is connected",
      canDisconnect: true,
      workspaceName: resolved.meta.workspaceName || "Vapi",
      connectedAt: resolved.meta.connectedAt,
      lastVerifiedAt: resolved.meta.lastVerifiedAt,
      connectPath: "/connections/vapi/setup",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
