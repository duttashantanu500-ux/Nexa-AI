/**
 * Canonical public origin for auth redirects (email, OAuth, recovery).
 * Production must never send users to localhost.
 */

export const PRODUCTION_APP_URL = "https://www.nexaiintelligence.online";

function isLocalHost(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "0.0.0.0"
    );
  } catch {
    return /localhost|127\.0\.0\.1/.test(url);
  }
}

/**
 * Public site origin used for email confirmation, OAuth, and recovery links.
 * - Browser: current origin, unless it is localhost while not in local dev
 * - Server: NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL / production default
 */
export function getAppUrl(): string {
  const fromEnv = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  ).replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    // Real local development only
    if (isLocalHost(origin)) {
      if (process.env.NODE_ENV === "development") return origin;
      // Deployed/misconfigured host claiming localhost — force production
      return (fromEnv && !isLocalHost(fromEnv) ? fromEnv : PRODUCTION_APP_URL);
    }
    return origin;
  }

  if (fromEnv && !isLocalHost(fromEnv)) return fromEnv;

  // Vercel system URL (preview) — prefer custom production domain when available
  const vercel = (process.env.VERCEL_URL || "").replace(/\/$/, "");
  if (vercel && process.env.VERCEL_ENV === "production") {
    return PRODUCTION_APP_URL;
  }
  if (vercel && !isLocalHost(vercel)) {
    return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  }

  return PRODUCTION_APP_URL;
}

/** Absolute URL for auth redirects (callback, recovery, OAuth). */
export function getAuthRedirectUrl(path = "/auth/callback"): string {
  const base = getAppUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
