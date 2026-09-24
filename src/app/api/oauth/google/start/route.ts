import { NextRequest, NextResponse } from "next/server";

function resolveAppUrl(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_URL)
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = resolveAppUrl(req);
  const provider = req.nextUrl.searchParams.get("provider") || "gmail";

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        ok: false,
        status: "configuration_required",
        missingEnv: [
          ...(!clientId ? ["GOOGLE_CLIENT_ID"] : []),
          ...(!clientSecret ? ["GOOGLE_CLIENT_SECRET"] : []),
        ],
        message:
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, add redirect URI, redeploy.",
        redirectUri: `${appUrl}/api/oauth/google/callback`,
      },
      { status: 200 }
    );
  }

  const scopes =
    provider === "gdrive"
      ? ["openid", "email", "https://www.googleapis.com/auth/drive.readonly"]
      : provider === "gcal"
        ? ["openid", "email", "https://www.googleapis.com/auth/calendar.readonly"]
        : [
            "openid",
            "email",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
          ];

  const redirectUri = `${appUrl}/api/oauth/google/callback`;
  const state = Buffer.from(
    JSON.stringify({ provider, t: Date.now() })
  ).toString("base64url");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
