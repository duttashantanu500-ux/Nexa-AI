import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ensureFreeSubscription,
  getBillingSnapshot,
  getUserSubscription,
  incrementRunCount,
} from "@/lib/billing";
import { LIMIT_MESSAGES } from "@/lib/plans";

export const runtime = "nodejs";

function userClient(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Record one real agent run against the user's monthly allowance. */
export async function POST(req: NextRequest) {
  try {
    const sb = userClient(req);
    if (!sb) {
      return NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    const { data: authData, error: authErr } = await sb.auth.getUser();
    if (authErr || !authData.user) {
      return NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    const userId = authData.user.id;
    await ensureFreeSubscription(userId);
    const snap = await getBillingSnapshot(userId);

    if (snap.runsUsedThisPeriod >= snap.limits.maxRunsPerMonth) {
      return NextResponse.json(
        {
          ok: false,
          limitReached: true,
          message: LIMIT_MESSAGES.runs,
          runsUsedThisPeriod: snap.runsUsedThisPeriod,
          maxRunsPerMonth: snap.limits.maxRunsPerMonth,
        },
        { status: 403 }
      );
    }

    const sub = await getUserSubscription(userId);
    const next = await incrementRunCount(userId, sub?.current_period_start);

    return NextResponse.json({
      ok: true,
      runsUsedThisPeriod: next,
      maxRunsPerMonth: snap.limits.maxRunsPerMonth,
    });
  } catch (e) {
    console.error("billing/record-run", e);
    return NextResponse.json(
      { ok: false, message: "Could not record run." },
      { status: 500 }
    );
  }
}
