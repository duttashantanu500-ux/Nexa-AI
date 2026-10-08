import type { NextRequest } from "next/server";

/**
 * Canonical public origin for OAuth redirect_uri.
 * Must match the redirect URI registered with each provider character-for-character.
 * Prefer NEXT_PUBLIC_APP_URL; fall back to request host; never mix www / non-www.
 */
export function oauthAppOrigin(req?: NextRequest | null): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (env) {
    try {
      const u = new URL(env.startsWith("http") ? env : `https://${env}`);
      // Production canonical host
      if (
        u.hostname === "nexaiintelligence.online" ||
        u.hostname === "www.nexaiintelligence.online"
      ) {
        return "https://www.nexaiintelligence.online";
      }
      return `${u.protocol}//${u.host}`;
    } catch {
      /* fall through */
    }
  }

  if (req) {
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      req.nextUrl.host;
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (req.nextUrl.protocol === "https:" ? "https" : "http");
    if (host) {
      const h = host.replace(/\/$/, "");
      if (
        h === "nexaiintelligence.online" ||
        h === "www.nexaiintelligence.online"
      ) {
        return "https://www.nexaiintelligence.online";
      }
      return `${proto}://${h}`;
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
