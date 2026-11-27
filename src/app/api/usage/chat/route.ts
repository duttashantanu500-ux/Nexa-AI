import { NextRequest, NextResponse } from "next/server";
import {
  getBillingSnapshot,
  incrementChatMessages,
} from "@/lib/billing";
import { LIMIT_MESSAGES } from "@/lib/plans";

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

    const snap = await getBillingSnapshot(userId);
    const max = snap.limits.maxChatMessagesPerMonth;
    const used = snap.chatMessagesThisPeriod;

    if (Number.isFinite(max) && used >= max) {
      return NextResponse.json(
        {
          ok: false,
          limitReached: true,
          error: LIMIT_MESSAGES.chat,
          chatMessages: used,
          maxChatMessagesPerMonth: max,
        },
        { status: 429 }
      );
    }

    const total = await incrementChatMessages(userId, by);
    return NextResponse.json({
      ok: true,
      chatMessages: total,
      maxChatMessagesPerMonth: max,
      remaining: Number.isFinite(max) ? Math.max(0, max - total) : null,
    });
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
    const maxChat = snap.limits.maxChatMessagesPerMonth;
    return NextResponse.json({
      ok: true,
      planId: snap.planId,
      runsUsedThisPeriod: snap.runsUsedThisPeriod,
      maxRunsPerMonth: snap.limits.maxRunsPerMonth,
      chatMessagesThisPeriod: snap.chatMessagesThisPeriod,
      maxChatMessagesPerMonth: maxChat,
      chatRemaining: Number.isFinite(maxChat)
        ? Math.max(0, maxChat - snap.chatMessagesThisPeriod)
        : null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not load usage." }, { status: 500 });
  }
}
