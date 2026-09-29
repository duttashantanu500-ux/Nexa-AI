/**
 * Nexa billing helpers — Dodo Payments + plan resolution.
 * Server-side only for secrets; status reads may run from API routes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type PlanId,
  type SubscriptionStatus,
  effectivePlanId,
  getPlan,
  hasProAccess,
  type PlanLimits,
} from "./plans";

export function adminDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function dodoBaseUrl(): string {
  const env = (process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode").toLowerCase();
  if (env === "test_mode" || env === "test") {
    return "https://test.dodopayments.com";
  }
  return "https://live.dodopayments.com";
}

export function isDodoConfigured(): boolean {
  return Boolean(process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_PRO_PRODUCT_ID);
}

export interface UserSubscriptionRow {
  user_id: string;
  plan: PlanId;
  status: SubscriptionStatus;
  dodo_subscription_id: string | null;
  dodo_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
}

export interface BillingSnapshot {
  planId: PlanId;
  status: SubscriptionStatus;
  limits: PlanLimits;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  runsUsedThisPeriod: number;
}

function defaultFreeSnapshot(): BillingSnapshot {
  const plan = getPlan("free");
  return {
    planId: "free",
    status: "free",
    limits: plan.limits,
    periodStart: null,
    periodEnd: null,
    cancelAtPeriodEnd: false,
    runsUsedThisPeriod: 0,
  };
}

export async function getUserSubscription(
  userId: string
): Promise<UserSubscriptionRow | null> {
  const sb = adminDb();
  if (!sb || !userId) return null;
  const { data, error } = await sb
    .from("nexa_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserSubscriptionRow;
}

function currentPeriodKey(periodStart?: string | null): string {
  if (periodStart) {
    const d = new Date(periodStart);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }
  }
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getRunsUsed(
  userId: string,
  periodStart?: string | null
): Promise<number> {
  const sb = adminDb();
  if (!sb || !userId) return 0;
  const key = currentPeriodKey(periodStart);
  const { data } = await sb
    .from("nexa_usage_monthly")
    .select("runs_count")
    .eq("user_id", userId)
    .eq("period_key", key)
    .maybeSingle();
  return typeof data?.runs_count === "number" ? data.runs_count : 0;
}

export async function incrementRunCount(
  userId: string,
  periodStart?: string | null
): Promise<number> {
  const sb = adminDb();
  if (!sb || !userId) return 0;
  const key = currentPeriodKey(periodStart);
  const existing = await getRunsUsed(userId, periodStart);
  const next = existing + 1;
  await sb.from("nexa_usage_monthly").upsert(
    {
      user_id: userId,
      period_key: key,
      runs_count: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,period_key" }
  );
  return next;
}

export async function getBillingSnapshot(userId: string): Promise<BillingSnapshot> {
  if (!userId) return defaultFreeSnapshot();
  const row = await getUserSubscription(userId);
  if (!row) return defaultFreeSnapshot();

  const planId = effectivePlanId(row.status);
  const plan = getPlan(planId);
  const runsUsedThisPeriod = await getRunsUsed(userId, row.current_period_start);

  return {
    planId,
    status: row.status,
    limits: plan.limits,
    periodStart: row.current_period_start,
    periodEnd: row.current_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    runsUsedThisPeriod,
  };
}

export async function ensureFreeSubscription(userId: string): Promise<void> {
  const sb = adminDb();
  if (!sb || !userId) return;
  const existing = await getUserSubscription(userId);
  if (existing) return;
  await sb.from("nexa_subscriptions").upsert(
    {
      user_id: userId,
      plan: "free",
      status: "free",
      dodo_subscription_id: null,
      dodo_customer_id: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

/** Map Dodo subscription status → Nexa status */
export function mapDodoStatus(
  dodoStatus: string | undefined,
  cancelAtPeriodEnd?: boolean
): SubscriptionStatus {
  const s = (dodoStatus || "").toLowerCase();
  if (s === "active") return cancelAtPeriodEnd ? "canceling" : "active";
  if (s === "on_hold") return "on_hold";
  if (s === "past_due") return "past_due";
  if (s === "cancelled" || s === "canceled") return "canceling";
  if (s === "expired") return "expired";
  if (s === "failed") return "failed";
  if (s === "paused") return "on_hold";
  return "free";
}

export async function applySubscriptionFromDodo(params: {
  userId: string;
  dodoSubscriptionId?: string | null;
  dodoCustomerId?: string | null;
  dodoStatus?: string;
  cancelAtPeriodEnd?: boolean;
  periodStart?: string | null;
  periodEnd?: string | null;
}): Promise<void> {
  const sb = adminDb();
  if (!sb || !params.userId) return;

  const status = mapDodoStatus(params.dodoStatus, params.cancelAtPeriodEnd);
  const planId: PlanId = hasProAccess(status) ? "pro" : "free";

  await sb.from("nexa_subscriptions").upsert(
    {
      user_id: params.userId,
      plan: planId,
      status,
      dodo_subscription_id: params.dodoSubscriptionId || null,
      dodo_customer_id: params.dodoCustomerId || null,
      current_period_start: params.periodStart || null,
      current_period_end: params.periodEnd || null,
      cancel_at_period_end: Boolean(params.cancelAtPeriodEnd),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  name?: string;
  returnUrl: string;
}): Promise<{ ok: true; checkoutUrl: string } | { ok: false; message: string }> {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const productId = process.env.DODO_PRO_PRODUCT_ID;
  if (!apiKey || !productId) {
    return {
      ok: false,
      message: "Billing is not available right now. Please try again later.",
    };
  }

  await ensureFreeSubscription(params.userId);

  try {
    const res = await fetch(`${dodoBaseUrl()}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: {
          email: params.email,
          name: params.name || params.email.split("@")[0],
        },
        return_url: params.returnUrl,
        metadata: {
          nexa_user_id: params.userId,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Dodo checkout error", res.status, text.slice(0, 300));
      return {
        ok: false,
        message: "We couldn't start checkout. Please try again.",
      };
    }

    const data = (await res.json()) as { checkout_url?: string };
    if (!data.checkout_url) {
      return {
        ok: false,
        message: "We couldn't start checkout. Please try again.",
      };
    }
    return { ok: true, checkoutUrl: data.checkout_url };
  } catch (e) {
    console.error("Dodo checkout exception", e);
    return {
      ok: false,
      message: "We couldn't start checkout. Please try again.",
    };
  }
}

/**
 * Verify Standard Webhooks signature (Dodo).
 * signed_content = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 */
export function verifyDodoWebhookSignature(params: {
  rawBody: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
  secret: string;
}): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require("crypto") as typeof import("crypto");
    let key = params.secret;
    if (key.startsWith("whsec_")) key = key.slice(6);
    const keyBuf = Buffer.from(key, "base64");
    const signed = `${params.webhookId}.${params.webhookTimestamp}.${params.rawBody}`;
    const expected = crypto.createHmac("sha256", keyBuf).update(signed).digest("base64");
    const parts = params.webhookSignature.split(" ");
    for (const part of parts) {
      const sig = part.startsWith("v1,") ? part.slice(3) : part;
      const a = Buffer.from(expected);
      const b = Buffer.from(sig);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function extractUserIdFromDodoPayload(data: Record<string, unknown>): string | null {
  const meta = (data.metadata || {}) as Record<string, unknown>;
  if (typeof meta.nexa_user_id === "string" && meta.nexa_user_id) {
    return meta.nexa_user_id;
  }
  return null;
}
