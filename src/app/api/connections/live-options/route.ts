import { NextRequest, NextResponse } from "next/server";
import { loadLiveAccountOptions } from "@/lib/agentBuilder/liveAccountOptions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET/POST — return real Notion pages, Slack/Buffer channels, HubSpot samples
 * for the signed-in user so Hiring Desk / employee chat can show pickers.
 */
export async function GET(req: NextRequest) {
  const userId = String(req.nextUrl.searchParams.get("userId") || "").trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false, message: "Sign in required.", options: null },
      { status: 401 }
    );
  }
  try {
    const options = await loadLiveAccountOptions(userId);
    return NextResponse.json({ ok: true, options });
  } catch (e) {
    console.error("[live-options]", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Failed to load account options",
        options: null,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = String((body as { userId?: string }).userId || "").trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false, message: "Sign in required.", options: null },
      { status: 401 }
    );
  }
  try {
    const options = await loadLiveAccountOptions(userId);
    return NextResponse.json({ ok: true, options });
  } catch (e) {
    console.error("[live-options]", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Failed to load account options",
        options: null,
      },
      { status: 500 }
    );
  }
}
