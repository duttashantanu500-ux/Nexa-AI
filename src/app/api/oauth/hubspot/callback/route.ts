import { NextRequest, NextResponse } from "next/server";
import { saveConnection, verifyOAuthState } from "@/lib/connectors/tokenStore";
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
  const origin = appOrigin();
  const fail = (msg: string) =>
    NextResponse.redirect(
      `${origin}/connections/hubspot?error=${encodeURIComponent(msg)}`
    );

  if (!hubspotOAuthConfigured()) {
    return fail("HubSpot is not set up on this site yet.");
  }

  const code = req.nextUrl.searchParams.get("code")?.trim();
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    return fail(
      oauthError === "access_denied"
        ? "You declined HubSpot access. You can try again anytime."
        : `HubSpot returned an error: ${oauthError}`
    );
  }

  if (!code) {
    return fail("Missing authorization code from HubSpot.");
  }

  const verified = verifyOAuthState(state);
  if (!verified?.userId) {
    return fail("This connection link expired or is invalid. Please try Connect again.");
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID!.trim();
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET!.trim();
  const redirectUri = `${origin}/api/oauth/hubspot/callback`;

  try {
    const tokenRes = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = (await tokenRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[hubspot/callback] token exchange failed", tokenData);
      return fail("Could not complete HubSpot connection. Please try again.");
    }

    // Optional: fetch hub info for display name
    let workspaceName: string | undefined;
    let workspaceId: string | undefined;
    try {
      const infoRes = await fetch(
        `https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(
          String(tokenData.access_token)
        )}`
      );
      if (infoRes.ok) {
        const info = (await infoRes.json()) as Record<string, unknown>;
        workspaceId = info.hub_id != null ? String(info.hub_id) : undefined;
        workspaceName =
          (info.hub_domain as string) ||
          (workspaceId ? `Hub ${workspaceId}` : undefined);
      }
    } catch {
      /* non-fatal */
    }

    await saveConnection({
      userId: verified.userId,
      connectorId: "hubspot",
      accessToken: String(tokenData.access_token),
      refreshToken: tokenData.refresh_token
        ? String(tokenData.refresh_token)
        : undefined,
      workspaceName,
      workspaceId,
      scopes: HUBSPOT_SCOPES.split(" "),
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    });

    return NextResponse.redirect(
      `${origin}/connections/hubspot?connected=1`
    );
  } catch (e) {
    console.error("[hubspot/callback]", e);
    return fail("Something went wrong connecting HubSpot. Please try again.");
  }
}
