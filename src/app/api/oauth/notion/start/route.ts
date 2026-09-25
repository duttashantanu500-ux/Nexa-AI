import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "Notion is not configured. Set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET.",
      },
      { status: 503 }
    );
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const redirect = `${origin.replace(/\/$/, "")}/api/oauth/notion/callback`;
  const url = `https://api.notion.com/v1/oauth/authorize?client_id=${encodeURIComponent(
    clientId
  )}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirect)}`;
  return NextResponse.redirect(url);
}
