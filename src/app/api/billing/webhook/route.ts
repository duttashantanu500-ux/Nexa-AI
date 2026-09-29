import { NextRequest, NextResponse } from "next/server";
import {
  adminDb,
  applySubscriptionFromDodo,
  extractUserIdFromDodoPayload,
  verifyDodoWebhookSignature,
} from "@/lib/billing";

export const runtime = "nodejs";

/**
 * Dodo Payments webhooks (Standard Webhooks).
 * Activate / renew / cancel Pro only from verified events.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY || "";
  const rawBody = await req.text();
  const webhookId = req.headers.get("webhook-id") || "";
  const webhookSignature = req.headers.get("webhook-signature") || "";
  const webhookTimestamp = req.headers.get("webhook-timestamp") || "";

  if (!secret) {
    console.error("DODO_PAYMENTS_WEBHOOK_KEY missing");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const valid = verifyDodoWebhookSignature({
    rawBody,
    webhookId,
    webhookTimestamp,
    webhookSignature,
    secret,
  });

  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: {
    type?: string;
    data?: Record<string, unknown>;
    timestamp?: string;
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const sb = adminDb();
  if (sb && webhookId) {
    const { data: seen } = await sb
      .from("nexa_webhook_events")
      .select("webhook_id")
      .eq("webhook_id", webhookId)
      .maybeSingle();
    if (seen) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  const type = event.type || "";
  const data = (event.data || {}) as Record<string, unknown>;

  try {
    await handleEvent(type, data);
    if (sb && webhookId) {
      await sb.from("nexa_webhook_events").upsert({
        webhook_id: webhookId,
        event_type: type,
        processed_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error("billing webhook handler", type, e);
    return NextResponse.json({ received: true, handled: false });
  }

  return NextResponse.json({ received: true });
}

async function resolveUserId(data: Record<string, unknown>): Promise<string | null> {
  const fromMeta = extractUserIdFromDodoPayload(data);
  if (fromMeta) return fromMeta;

  const sb = adminDb();
  if (!sb) return null;

  const subId =
    (typeof data.subscription_id === "string" && data.subscription_id) ||
    (typeof data.subscriptionId === "string" && data.subscriptionId) ||
    null;
  if (subId) {
    const { data: row } = await sb
      .from("nexa_subscriptions")
      .select("user_id")
      .eq("dodo_subscription_id", subId)
      .maybeSingle();
    if (row?.user_id) return row.user_id as string;
  }

  const customer =
    (data.customer as Record<string, unknown> | undefined) || undefined;
  const customerId =
    (customer && typeof customer.customer_id === "string" && customer.customer_id) ||
    (typeof data.customer_id === "string" && data.customer_id) ||
    null;
  if (customerId) {
    const { data: row } = await sb
      .from("nexa_subscriptions")
      .select("user_id")
      .eq("dodo_customer_id", customerId)
      .maybeSingle();
    if (row?.user_id) return row.user_id as string;
  }

  return null;
}

function periodFields(data: Record<string, unknown>) {
  const start =
    (typeof data.previous_billing_date === "string" && data.previous_billing_date) ||
    (typeof data.current_period_start === "string" && data.current_period_start) ||
    null;
  const end =
    (typeof data.next_billing_date === "string" && data.next_billing_date) ||
    (typeof data.current_period_end === "string" && data.current_period_end) ||
    null;
  return { start, end };
}

async function handleEvent(type: string, data: Record<string, unknown>) {
  const userId = await resolveUserId(data);
  if (!userId) {
    console.warn("billing webhook: no user for event", type);
    return;
  }

  const subId =
    (typeof data.subscription_id === "string" && data.subscription_id) ||
    null;
  const customer =
    (data.customer as Record<string, unknown> | undefined) || undefined;
  const customerId =
    (customer && typeof customer.customer_id === "string" && customer.customer_id) ||
    (typeof data.customer_id === "string" && data.customer_id) ||
    null;
  const dodoStatus =
    (typeof data.status === "string" && data.status) || undefined;
  const cancelAtPeriodEnd = Boolean(
    data.cancel_at_next_billing_date || data.cancel_at_period_end
  );
  const { start, end } = periodFields(data);

  switch (type) {
    case "subscription.active":
    case "subscription.renewed":
    case "subscription.updated":
    case "subscription.plan_changed":
    case "subscription.past_due":
    case "subscription.on_hold":
    case "subscription.cancelled":
    case "subscription.expired":
    case "subscription.failed":
    case "subscription.paused":
    case "subscription.unpaused": {
      let status = dodoStatus;
      if (type === "subscription.cancelled") status = status || "cancelled";
      if (type === "subscription.expired") status = "expired";
      if (type === "subscription.failed") status = "failed";
      if (type === "subscription.on_hold" || type === "subscription.paused") {
        status = status || "on_hold";
      }
      if (type === "subscription.active" || type === "subscription.renewed") {
        status = "active";
      }

      await applySubscriptionFromDodo({
        userId,
        dodoSubscriptionId: subId,
        dodoCustomerId: customerId,
        dodoStatus: status,
        cancelAtPeriodEnd:
          type === "subscription.cancelled" ? true : cancelAtPeriodEnd,
        periodStart: start,
        periodEnd: end,
      });
      break;
    }
    case "payment.succeeded": {
      if (subId) {
        await applySubscriptionFromDodo({
          userId,
          dodoSubscriptionId: subId,
          dodoCustomerId: customerId,
          dodoStatus: "active",
          periodStart: start,
          periodEnd: end,
        });
      }
      break;
    }
    default:
      break;
  }
}
