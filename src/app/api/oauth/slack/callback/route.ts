import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/connections?error=slack_not_configured", req.url)
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL("/connections?error=slack_denied", req.url)
    );
  }
  // Token exchange — store server-side in production (e.g. encrypted DB).
  // For now, acknowledge success only if Slack accepts the code.
  try {
    const res = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      return NextResponse.redirect(
        new URL("/connections?error=slack_token", req.url)
      );
    }
    // Tokens must not be returned to the browser. Persist server-side when DB is ready.
    return NextResponse.redirect(
      new URL("/connections?connected=slack&note=token_server_side_pending", req.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/connections?error=slack_network", req.url)
    );
  }
}
