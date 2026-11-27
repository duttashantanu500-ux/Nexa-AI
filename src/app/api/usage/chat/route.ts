import { NextRequest, NextResponse } from "next/server";
import {
  getBillingSnapshot,
  incrementChatMessages,
} from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — record chat messages for a user (default +2 = user + assistant). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    const by = typeof body.by === "number" ? body.by : 2;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }
    const total = await incrementChatMessages(userId, by);
    return NextResponse.json({ ok: true, chatMessages: total });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not record usage." }, { status: 500 });
  }
}

/** GET — usage snapshot for a user. */
export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }
    const snap = await getBillingSnapshot(userId);
    return NextResponse.json({
      ok: true,
      planId: snap.planId,
      runsUsedThisPeriod: snap.runsUsedThisPeriod,
      maxRunsPerMonth: snap.limits.maxRunsPerMonth,
      chatMessagesThisPeriod: snap.chatMessagesThisPeriod,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not load usage." }, { status: 500 });
  }
}
