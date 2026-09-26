import { NextRequest, NextResponse } from "next/server";
import { saveConnection, verifyOAuthState } from "@/lib/connectors/tokenStore";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";

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
    return NextResponse.redirect(
      `${origin}/connections/notion?error=${encodeURIComponent(err)}`
    );
  }

  const userId = verifyOAuthState(state);
  if (!userId) {
    return NextResponse.redirect(`${origin}/connections/notion?error=invalid_state`);
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret || !code) {
    return NextResponse.redirect(`${origin}/connections/notion?error=notion_oauth`);
  }

  try {
    const redirectUri = `${origin}/api/oauth/notion/callback`;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = await res.json();
    if (!data.access_token) {
      return NextResponse.redirect(`${origin}/connections/notion?error=notion_token`);
    }

    // Verify token with Notion before marking connected
    const verify = await notionVerifyToken(data.access_token);
    if (!verify.ok) {
      return NextResponse.redirect(`${origin}/connections/notion?error=notion_verify`);
    }

    await saveConnection({
      userId,
      connectorId: "notion",
      accessToken: data.access_token,
      workspaceName: data.workspace_name || data.workspace_id,
      workspaceId: data.workspace_id,
      botId: data.bot_id,
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    });

    return NextResponse.redirect(`${origin}/connections/notion?connected=1`);
  } catch {
    return NextResponse.redirect(`${origin}/connections/notion?error=notion_network`);
  }
}
