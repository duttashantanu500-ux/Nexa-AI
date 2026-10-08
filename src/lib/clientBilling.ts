/**
 * Client-side billing helpers (no secrets).
 * Plan status is loaded from /api/billing/status with cache.
 */

import {
  PLAN_FREE,
  PLAN_PRO,
  getPlan,
  hasProAccess,
  LIMIT_MESSAGES,
  type PlanId,
  type PlanLimits,
} from "./plans";

export type ClientBillingState = {
  planId: PlanId;
  planName: string;
  status: string;
  priceLabel: string;
  limits: PlanLimits;
  features: string[];
  runsUsedThisPeriod: number;
  periodEnd?: string | null;
  loading: boolean;
};

const EXTERNAL_PROVIDERS = ["notion", "slack", "buffer", "hubspot", "ideogram", "mcp"] as const;

let cachedBilling: ClientBillingState | null = null;
let cacheTs = 0;
const CACHE_MS = 30_000;

function defaultBilling(): ClientBillingState {
  return {
    planId: "free",
    planName: PLAN_FREE.name,
    status: "active",
    priceLabel: PLAN_FREE.priceLabel,
    limits: PLAN_FREE.limits,
    features: PLAN_FREE.features,
    runsUsedThisPeriod: 0,
    periodEnd: null,
    loading: false,
  };
}

export function clearBillingCache() {
  cachedBilling = null;
  cacheTs = 0;
}

async function resolveAccessToken(): Promise<string | null> {
  try {
    const { createBrowserClient } = await import("@/lib/supabaseBrowser");
    const supabase = createBrowserClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function fetchBillingStatus(
  force = false
): Promise<ClientBillingState> {
  if (!force && cachedBilling && Date.now() - cacheTs < CACHE_MS) {
    return cachedBilling;
  }
  const token = await resolveAccessToken();
  if (!token) {
    const d = defaultBilling();
    cachedBilling = d;
    cacheTs = Date.now();
    return d;
  }
  try {
    const res = await fetch("/api/billing/status", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    const planId = (data.planId === "pro" ? "pro" : "free") as PlanId;
    const plan = getPlan(planId);
    const state: ClientBillingState = {
      planId,
      planName: data.planName || plan.name,
      status: data.status || "active",
      priceLabel: data.priceLabel || plan.priceLabel,
      limits: {
        maxAgents: data.limits?.maxAgents ?? plan.limits.maxAgents,
        maxConnections:
          data.limits?.maxConnections == null
            ? plan.limits.maxConnections
            : data.limits.maxConnections,
        maxRunsPerMonth:
          data.limits?.maxRunsPerMonth ?? plan.limits.maxRunsPerMonth,
        vaultBytes: data.limits?.vaultBytes ?? plan.limits.vaultBytes,
        advancedWorkflow: Boolean(data.limits?.advancedWorkflow),
        priorityExecution: Boolean(data.limits?.priorityExecution),
      },
      features: data.features || plan.features,
      runsUsedThisPeriod: Number(data.runsUsedThisPeriod) || 0,
      periodEnd: data.periodEnd || null,
      loading: false,
    };
    cachedBilling = state;
    cacheTs = Date.now();
    return state;
  } catch {
    const d = defaultBilling();
    cachedBilling = d;
    cacheTs = Date.now();
    return d;
  }
}

export async function startCheckout(): Promise<
  | { ok: true; checkoutUrl: string }
  | { ok: false; message: string }
> {
  const token = await resolveAccessToken();
  if (!token) return { ok: false, message: "Please sign in." };
  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok || !data.checkoutUrl) {
      return {
        ok: false,
        message: data.message || "Could not start checkout.",
      };
    }
    return { ok: true, checkoutUrl: data.checkoutUrl };
  } catch {
    return {
      ok: false,
      message: "We couldn't start checkout. Please try again.",
    };
  }
}

export async function getConnectedExternalCount(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    // Single batch call — same source of truth as Connections UI (token presence only)
    const res = await fetch(
      `/api/connections/status?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    const statuses = (data?.statuses || {}) as Record<string, { status?: string }>;
    let n = 0;
    for (const p of EXTERNAL_PROVIDERS) {
      if (statuses[p]?.status === "connected") n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

export async function assertCanConnect(
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const billing = await fetchBillingStatus(true);
  const count = await getConnectedExternalCount(userId);
  return canConnectService(count, billing);
}

export async function recordAgentRun(): Promise<
  | { ok: true; runsUsedThisPeriod: number }
  | { ok: false; message: string; limitReached?: boolean }
> {
  const token = await resolveAccessToken();
  if (!token) return { ok: false, message: "Please sign in." };

  try {
    const res = await fetch("/api/billing/record-run", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.ok) {
      return {
        ok: false,
        message: data.message || LIMIT_MESSAGES.runs,
        limitReached: Boolean(data.limitReached),
      };
    }
    clearBillingCache();
    return { ok: true, runsUsedThisPeriod: data.runsUsedThisPeriod || 0 };
  } catch {
    // Soft-allow on transient flake when signed in — never block free users on network blip
    return { ok: true, runsUsedThisPeriod: 0 };
  }
}

export function countActiveConnections(
  connections: { provider?: string; status?: string }[]
): number {
  return connections.filter(
    (c) =>
      c.provider !== "builtin" &&
      (c.status === "connected" || c.status === "available")
  ).length;
}

export function canCreateAgent(
  agentCount: number,
  billing: ClientBillingState
): { ok: true } | { ok: false; message: string } {
  if (agentCount >= billing.limits.maxAgents) {
    return { ok: false, message: LIMIT_MESSAGES.agents };
  }
  return { ok: true };
}

export function canConnectService(
  activeConnectionCount: number,
  billing: ClientBillingState
): { ok: true } | { ok: false; message: string } {
  if (
    billing.limits.maxConnections !== Number.POSITIVE_INFINITY &&
    activeConnectionCount >= billing.limits.maxConnections
  ) {
    return { ok: false, message: LIMIT_MESSAGES.connections };
  }
  return { ok: true };
}

export function canRunAgent(
  billing: ClientBillingState
): { ok: true } | { ok: false; message: string } {
  if (billing.runsUsedThisPeriod >= billing.limits.maxRunsPerMonth) {
    return { ok: false, message: LIMIT_MESSAGES.runs };
  }
  return { ok: true };
}

export function canUseVault(
  usedBytes: number,
  addBytes: number,
  billing: ClientBillingState
): { ok: true } | { ok: false; message: string } {
  if (usedBytes + addBytes > billing.limits.vaultBytes) {
    return { ok: false, message: LIMIT_MESSAGES.vault };
  }
  return { ok: true };
}

export { PLAN_FREE, hasProAccess, LIMIT_MESSAGES };
