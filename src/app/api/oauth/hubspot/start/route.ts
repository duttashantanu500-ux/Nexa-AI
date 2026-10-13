import { NextRequest, NextResponse } from "next/server";
import {
  HUBSPOT_SCOPES,
  generatePkcePair,
  hubspotOAuthConfigured,
  signHubspotOAuthState,
} from "@/lib/connectors/hubspotAuth";
import { oauthAppOrigin } from "@/lib/oauthOrigin";

export async function GET(req: NextRequest) {
  if (!hubspotOAuthConfigured()) {
    return NextResponse.json(
      { error: "HubSpot is not set up on this site yet." },
      { status: 503 }
    );
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in and try Connect again." },
      { status: 400 }
    );
  }

  const { assertCanAddConnection } = await import("@/lib/serverPlanGate");
  const gate = await assertCanAddConnection(userId, "hubspot");
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.message, limitReached: true },
      { status: 403 }
    );
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID!.trim();
  const origin = oauthAppOrigin(req);
  const redirect = `${origin}/api/oauth/hubspot/callback`;
  const { verifier, challenge } = generatePkcePair();
  const state = signHubspotOAuthState(userId, verifier);

  const url = new URL("https://app.hubspot.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", HUBSPOT_SCOPES);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(url.toString());
}
