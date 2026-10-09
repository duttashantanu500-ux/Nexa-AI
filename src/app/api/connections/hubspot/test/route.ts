import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { touchVerified } from "@/lib/connectors/tokenStore";
import { hubspotVerifyToken } from "@/lib/connectors/providers/hubspot";
import { resolveHubspotToken } from "@/lib/connectors/hubspotAuth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ("error" in auth) return auth.error;
    const userId = auth.userId;

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
