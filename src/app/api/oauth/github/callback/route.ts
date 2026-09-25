import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret || !code) {
    return NextResponse.redirect(
      new URL("/connections?error=github_oauth", req.url)
    );
  }
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    const data = await res.json();
    if (!data.access_token) {
      return NextResponse.redirect(
        new URL("/connections?error=github_token", req.url)
      );
    }
    return NextResponse.redirect(
      new URL("/connections?connected=github&note=token_server_side_pending", req.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/connections?error=github_network", req.url)
    );
  }
}
