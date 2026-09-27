import { NextRequest, NextResponse } from "next/server";
import { saveConnection, verifyOAuthState } from "@/lib/connectors/tokenStore";
import { slackVerifyToken } from "@/lib/connectors/providers/slack";

function appOrigin(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const err = req.nextUrl.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(`${origin}/connections/slack?error=cancelled`);
  }

  const userId = verifyOAuthState(state);
  if (!userId) {
    return NextResponse.redirect(`${origin}/connections/slack?error=session`);
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret || !code) {
    return NextResponse.redirect(`${origin}/connections/slack?error=setup`);
  }

  try {
    const redirectUri = `${origin}/api/oauth/slack/callback`;
    const res = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = await res.json();
    if (!data.ok || !data.access_token) {
      return NextResponse.redirect(`${origin}/connections/slack?error=auth`);
    }

    const token = data.access_token as string;
    const verify = await slackVerifyToken(token);
    if (!verify.ok) {
      return NextResponse.redirect(`${origin}/connections/slack?error=verify`);
    }

    const saved = await saveConnection({
      userId,
      connectorId: "slack",
      accessToken: token,
      workspaceName: data.team?.name || data.team?.id,
      workspaceId: data.team?.id,
      botId: data.bot_user_id,
      scopes: typeof data.scope === "string" ? data.scope.split(",") : undefined,
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    });

    if (!saved.ok) {
      return NextResponse.redirect(`${origin}/connections/slack?error=save_failed`);
    }

    return NextResponse.redirect(`${origin}/connections/slack?connected=1`);
  } catch {
    return NextResponse.redirect(`${origin}/connections/slack?error=network`);
  }
}
