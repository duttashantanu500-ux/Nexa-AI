import { NextRequest, NextResponse } from "next/server";
import { signOAuthState } from "@/lib/connectors/tokenStore";

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
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Slack is not set up on this site yet." },
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

  const redirect = `${appOrigin()}/api/oauth/slack/callback`;
  const state = signOAuthState(userId);
  // Minimum scopes for list channels + send message
  const scopes = ["channels:read", "groups:read", "chat:write"].join(",");
  const url = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
    clientId
  )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
    redirect
  )}&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(url);
}
