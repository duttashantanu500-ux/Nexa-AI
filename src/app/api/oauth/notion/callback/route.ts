import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret || !code) {
    return NextResponse.redirect(
      new URL("/connections?error=notion_oauth", req.url)
    );
  }
  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const origin = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const redirect = `${origin.replace(/\/$/, "")}/api/oauth/notion/callback`;
    const res = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect,
      }),
    });
    const data = await res.json();
    if (!data.access_token) {
      return NextResponse.redirect(
        new URL("/connections?error=notion_token", req.url)
      );
    }
    return NextResponse.redirect(
      new URL("/connections?connected=notion&note=token_server_side_pending", req.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/connections?error=notion_network", req.url)
    );
  }
}
