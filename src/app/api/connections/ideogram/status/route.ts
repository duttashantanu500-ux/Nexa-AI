import { NextRequest, NextResponse } from "next/server";
import { ideogramVerifyKey } from "@/lib/connectors/providers/ideogram";
import { resolveIdeogramToken } from "@/lib/connectors/ideogramAuth";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return NextResponse.json({
      configured: true,
      status: "available",
      message: "Sign in, then connect your Ideogram account.",
      canDisconnect: false,
    });
  }

  const resolved = await resolveIdeogramToken(userId);
  if (!resolved) {
    return NextResponse.json({
      configured: true,
      status: "available",
      message: "Connect your Ideogram account to create images with your AI employees.",
      canDisconnect: false,
    });
  }

  const verify = await ideogramVerifyKey(resolved.token);
  if (!verify.ok) {
    return NextResponse.json({
      configured: true,
      status: "error",
      message: "Your Ideogram connection needs to be updated.",
      canDisconnect: true,
      workspaceName: resolved.meta.workspaceName || "Ideogram",
    });
  }

  return NextResponse.json({
    configured: true,
    status: "connected",
    message: "Your Ideogram account is connected",
    canDisconnect: true,
    workspaceName: resolved.meta.workspaceName || "Ideogram",
    connectedAt: resolved.meta.connectedAt,
    lastVerifiedAt: resolved.meta.lastVerifiedAt,
  });
}
