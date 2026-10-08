import { NextRequest, NextResponse } from "next/server";
import { saveConnection } from "@/lib/connectors/tokenStore";
import { verifyBufferOAuthState } from "@/lib/connectors/bufferAuth";
import { bufferVerifyToken } from "@/lib/connectors/providers/buffer";
import { oauthAppOrigin } from "@/lib/oauthOrigin";

export async function GET(req: NextRequest) {
  const origin = oauthAppOrigin(req);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const err = req.nextUrl.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(
      `${origin}/connections/buffer?error=cancelled`
    );
  }

  const verified = verifyBufferOAuthState(state);
  if (!verified) {
    return NextResponse.redirect(
      `${origin}/connections/buffer?error=session`
    );
  }

  const clientId = process.env.BUFFER_CLIENT_ID?.trim();
  if (!clientId || !code) {
    return NextResponse.redirect(`${origin}/connections/buffer?error=setup`);
  }

  try {
    const redirectUri = `${origin}/api/oauth/buffer/callback`;
    const body: Record<string, string> = {
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verified.codeVerifier,
    };
    const clientSecret = process.env.BUFFER_CLIENT_SECRET?.trim();
    if (clientSecret) {
      body.client_secret = clientSecret;
    }

    const res = await fetch("https://auth.buffer.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      const hint =
        typeof data.error_description === "string"
          ? data.error_description
          : typeof data.error === "string"
            ? data.error
            : "auth";
      const q = encodeURIComponent(
        String(hint).slice(0, 80).replace(/\s+/g, "_")
      );
      return NextResponse.redirect(
        `${origin}/connections/buffer?error=auth&detail=${q}`
      );
    }

    const token = data.access_token as string;
    const verify = await bufferVerifyToken(token);
    if (!verify.ok) {
      return NextResponse.redirect(
        `${origin}/connections/buffer?error=verify`
      );
    }

    const orgName =
      (verify.data as { organizationName?: string } | undefined)
        ?.organizationName ||
      (verify.data as { email?: string } | undefined)?.email ||
      undefined;

    const scopes =
      typeof data.scope === "string"
        ? data.scope.split(/\s+/).filter(Boolean)
        : undefined;

    const saved = await saveConnection({
      userId: verified.userId,
      connectorId: "buffer",
      accessToken: token,
      refreshToken: (data.refresh_token as string) || undefined,
      workspaceName: orgName,
      scopes,
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    });

    if (!saved.ok) {
      return NextResponse.redirect(
        `${origin}/connections/buffer?error=save_failed`
      );
    }

    return NextResponse.redirect(
      `${origin}/connections/buffer?connected=1`
    );
  } catch {
    return NextResponse.redirect(
      `${origin}/connections/buffer?error=network`
    );
  }
}
