import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "GitHub is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
      },
      { status: 503 }
    );
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const redirect = `${origin.replace(/\/$/, "")}/api/oauth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
    clientId
  )}&scope=${encodeURIComponent("repo read:user")}&redirect_uri=${encodeURIComponent(redirect)}`;
  return NextResponse.redirect(url);
}
