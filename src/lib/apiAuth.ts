/**
 * Server-side auth helpers for API routes.
 * User identity MUST come from a verified Supabase JWT, never from body/query alone.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";

export type AuthSuccess = { user: User; userId: string; accessToken: string };
export type AuthFailure = { error: NextResponse };

function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ") && auth.length > 20) {
    return auth.slice(7).trim();
  }
  return null;
}

/**
 * Verify the caller's Supabase access token and return the authenticated user.
 */
export async function requireAuthUser(
  req: NextRequest
): Promise<AuthSuccess | AuthFailure> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return {
      error: NextResponse.json(
        { ok: false, message: "Account service is not available." },
        { status: 503 }
      ),
    };
  }

  const token = extractBearer(req);
  if (!token) {
    return {
      error: NextResponse.json(
        { ok: false, message: "Please sign in first." },
        { status: 401 }
      ),
    };
  }

  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user?.id) {
    return {
      error: NextResponse.json(
        { ok: false, message: "Please sign in first." },
        { status: 401 }
      ),
    };
  }

  return { user: data.user, userId: data.user.id, accessToken: token };
}

/**
 * If the client also sent a userId, it must match the JWT subject (IDOR guard).
 */
export function assertUserIdMatch(
  authedUserId: string,
  claimedUserId: string | null | undefined
): NextResponse | null {
  const claimed = (claimedUserId || "").trim();
  if (!claimed) return null;
  if (claimed !== authedUserId) {
    return NextResponse.json(
      { ok: false, message: "Forbidden." },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Validate MCP / outbound URL to reduce SSRF risk.
 * Allows only http(s) to non-private hosts.
 */
export function isSafeOutboundUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, message: "Enter a valid https URL for your MCP server." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "MCP server URL must use https." };
  }

  // Prefer https in production
  if (
    process.env.NODE_ENV === "production" &&
    parsed.protocol !== "https:"
  ) {
    return { ok: false, message: "MCP server URL must use https." };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return { ok: false, message: "That host is not allowed." };
  }

  // Block obvious private IPv4 ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map((x) => Number(x));
    const [a, b] = parts;
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    ) {
      return { ok: false, message: "That host is not allowed." };
    }
  }

  return { ok: true, url: parsed.toString() };
}

/** Safe same-origin return URL for checkout redirects. */
export function safeReturnOrigin(
  claimed: unknown,
  req: NextRequest
): string {
  const fallback =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.nexaiintelligence.online";

  if (typeof claimed !== "string" || !claimed.trim()) {
    return fallback.replace(/\/$/, "");
  }

  try {
    const u = new URL(claimed.trim());
    const allowed = new Set<
      string
    >([
      "www.nexaiintelligence.online",
      "nexaiintelligence.online",
    ]);
    try {
      allowed.add(new URL(fallback).hostname);
    } catch {
      /* */
    }
    try {
      allowed.add(req.nextUrl.hostname);
    } catch {
      /* */
    }
    if (!allowed.has(u.hostname)) {
      return fallback.replace(/\/$/, "");
    }
    if (u.protocol !== "https:" && u.hostname !== "localhost") {
      return fallback.replace(/\/$/, "");
    }
    return u.origin;
  } catch {
    return fallback.replace(/\/$/, "");
  }
}
