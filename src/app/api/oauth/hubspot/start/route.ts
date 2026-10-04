import { NextRequest, NextResponse } from "next/server";
import { signOAuthState } from "@/lib/connectors/tokenStore";
import { HUBSPOT_SCOPES, hubspotOAuthConfigured } from "@/lib/connectors/hubspotAuth";

function appOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

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

  const clientId = process.env.HUBSPOT_CLIENT_ID!.trim();
  const redirect = `${appOrigin()}/api/oauth/hubspot/callback`;
  const state = signOAuthState(userId);
  const url =
    `https://app.hubspot.com/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(HUBSPOT_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(url);
}
