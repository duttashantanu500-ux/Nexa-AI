import { NextResponse } from "next/server";

function appOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "Slack is not configured. The Nexa administrator must set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.",
      },
      { status: 503 }
    );
  }

  const redirect = `${appOrigin()}/api/oauth/slack/callback`;
  const scopes = ["channels:read", "chat:write", "channels:history"].join(",");
  const url = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
    clientId
  )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirect)}`;

  return NextResponse.redirect(url);
}
