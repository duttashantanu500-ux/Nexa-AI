import { NextRequest, NextResponse } from "next/server";

/**
 * Google OAuth callback. Exchanges code for tokens server-side.
 * Tokens are NOT returned to the browser as secrets in the URL.
 * For MVP without encrypted vault: store only non-secret connection flag is insufficient —
 * we require SUPABASE + encrypted storage later. For now mark success only if token exchange works,
 * and store a short-lived session cookie with access token hash indicator (not the raw refresh in client JS).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const stateRaw = req.nextUrl.searchParams.get("state");
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : req.nextUrl.origin);

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/connections?oauth=error&message=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/connections?oauth=error&message=missing_code`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${appUrl}/connections?oauth=error&message=missing_credentials`
    );
  }

  const redirectUri = `${appUrl}/api/oauth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      return NextResponse.redirect(
        `${appUrl}/connections?oauth=error&message=${encodeURIComponent(
          tokens.error || "token_exchange_failed"
        )}`
      );
    }

    let provider = "gmail";
    try {
      if (stateRaw) {
        const st = JSON.parse(Buffer.from(stateRaw, "base64url").toString());
        provider = st.provider || "gmail";
      }
    } catch {
      /* */
    }

    // Real OAuth succeeded. We do NOT put refresh_token in localStorage.
    // Set httpOnly cookie with access token for server routes (short-lived MVP).
    // Production should use encrypted DB vault.
    const res = NextResponse.redirect(
      `${appUrl}/connections?oauth=success&provider=${provider}`
    );

    const maxAge = tokens.expires_in || 3600;
    res.cookies.set(`nexa_google_${provider}`, tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.min(maxAge, 3600),
    });

    if (tokens.refresh_token && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Placeholder: vault write would go here
    }

    return res;
  } catch (err: any) {
    return NextResponse.redirect(
      `${appUrl}/connections?oauth=error&message=${encodeURIComponent(
        err?.message || "oauth_failed"
      )}`
    );
  }
}
