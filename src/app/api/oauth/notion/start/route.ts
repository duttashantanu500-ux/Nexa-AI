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
  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "Notion is not configured. Set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET in Vercel.",
      },
      { status: 503 }
    );
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId. Open Connect from the Notion details page while signed in." },
      { status: 400 }
    );
  }

  const redirect = `${appOrigin()}/api/oauth/notion/callback`;
  const state = signOAuthState(userId);
  const url = `https://api.notion.com/v1/oauth/authorize?client_id=${encodeURIComponent(
    clientId
  )}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(
    redirect
  )}&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(url);
}
