import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ensureFreeSubscription,
  getBillingSnapshot,
} from "@/lib/billing";
import { getPlan, PLANS } from "@/lib/plans";

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

export async function GET(req: NextRequest) {
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
    const plan = getPlan(snap.planId);

    return NextResponse.json({
      ok: true,
      planId: snap.planId,
      planName: plan.name,
      status: snap.status,
      priceLabel: plan.priceLabel,
      limits: {
        maxAgents: plan.limits.maxAgents,
        maxConnections:
          plan.limits.maxConnections === Number.POSITIVE_INFINITY
            ? null
            : plan.limits.maxConnections,
        maxRunsPerMonth: plan.limits.maxRunsPerMonth,
        vaultBytes: plan.limits.vaultBytes,
        advancedWorkflow: plan.limits.advancedWorkflow,
        priorityExecution: plan.limits.priorityExecution,
      },
      features: plan.features,
      runsUsedThisPeriod: snap.runsUsedThisPeriod,
      periodEnd: snap.periodEnd,
      cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
      plans: {
        free: {
          id: "free",
          name: PLANS.free.name,
          priceLabel: PLANS.free.priceLabel,
          features: PLANS.free.features,
        },
        pro: {
          id: "pro",
          name: PLANS.pro.name,
          priceLabel: PLANS.pro.priceLabel,
          features: PLANS.pro.features,
        },
      },
    });
  } catch (e) {
    console.error("billing/status", e);
    return NextResponse.json(
      { ok: false, message: "Could not load plan details." },
      { status: 500 }
    );
  }
}
