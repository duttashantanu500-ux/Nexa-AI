import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Nexa-owned connect entry.
 * GET /connect/gmail?userId=...
 * Starts the connection on nexaiintelligence.online, then redirects
 * the browser to the app’s secure sign-in page.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ toolkit: string }> }
) {
  const { toolkit: raw } = await ctx.params;
  const toolkit = String(raw || "")
    .trim()
    .toLowerCase();
  const userId = String(req.nextUrl.searchParams.get("userId") || "").trim();

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    req.nextUrl.origin;

  if (!toolkit) {
    return NextResponse.redirect(`${origin}/connections?error=missing_app`);
  }
  if (!userId) {
    return NextResponse.redirect(
      `${origin}/login?next=${encodeURIComponent(`/connections`)}`
    );
  }

  try {
    const res = await fetch(`${origin}/api/composio/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, toolkit }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));

    if (data?.ok && data?.redirectUrl) {
      return NextResponse.redirect(String(data.redirectUrl));
    }

    const reason = encodeURIComponent(
      String(data?.error || "Could not start connection")
    );
    return NextResponse.redirect(
      `${origin}/connections?error=${reason}&app=${encodeURIComponent(toolkit)}`
    );
  } catch {
    return NextResponse.redirect(
      `${origin}/connections?error=${encodeURIComponent("Could not start connection")}&app=${encodeURIComponent(toolkit)}`
    );
  }
}
