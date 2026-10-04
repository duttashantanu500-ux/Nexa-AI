import { NextRequest, NextResponse } from "next/server";
import { touchVerified } from "@/lib/connectors/tokenStore";
import { hubspotVerifyToken } from "@/lib/connectors/providers/hubspot";
import { resolveHubspotToken } from "@/lib/connectors/hubspotAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Please sign in first." },
        { status: 400 }
      );
    }

    const resolved = await resolveHubspotToken(userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message: "Connect your HubSpot account first.",
      });
    }

    const verify = await hubspotVerifyToken(resolved.token);
    if (verify.ok) await touchVerified(userId, "hubspot");

    return NextResponse.json({
      ok: verify.ok,
      message: verify.ok
        ? "Success — Nexa can reach your HubSpot account."
        : verify.message || "Could not reach HubSpot.",
      data: verify.data,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
