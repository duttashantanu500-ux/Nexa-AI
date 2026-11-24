/**
 * Client-side billing helpers (no secrets).
 * Plan status is loaded from /api/billing/status with cache.
 * Connection counts come from Composio (max 3 accounts).
 */

import {
  PLAN_FREE,
  PLAN_PRO,
  getPlan,
  hasProAccess,
  LIMIT_MESSAGES,
  MAX_COMPOSIO_CONNECTIONS,
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
  cancelAtPeriodEnd?: boolean;
};

const STATUS_CACHE_KEY = "nexa_conn_status_v2";

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
    const { getSupabase } = await import("@/lib/supabase");
    const supabase = getSupabase();
    if (!supabase) return null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) return data.session.access_token;

      if (attempt === 1) {
        try {
          await supabase.auth.refreshSession();
        } catch {
          /* ignore */
        }
      }
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
    return null;
  } catch {
    return null;
  }
}

function hasOperatorUser(): boolean {
  try {
    const raw =
      localStorage.getItem("nexa_operator_v4") ||
      localStorage.getItem("nexa_operator_v3") ||
      localStorage.getItem("nexa_operator_v1");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { user?: { id?: string } };
    return Boolean(parsed?.user?.id);
  } catch {
    return false;
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
    // Force connection limit to product policy even if older API returns Infinity
    const limits = {
      ...(data.limits || plan.limits),
      maxConnections: MAX_COMPOSIO_CONNECTIONS,
    };
    const state: ClientBillingState = {
      planId,
      planName: data.planName || plan.name,
      status: data.status || "active",
      priceLabel: data.priceLabel || plan.priceLabel,
      limits,
      features: data.features || plan.features,
      runsUsedThisPeriod: Number(data.runsUsedThisPeriod) || 0,
      periodEnd: data.periodEnd || null,
      loading: false,
      cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
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
  let token = await resolveAccessToken();
  if (!token) {
    await new Promise((r) => setTimeout(r, 350));
    token = await resolveAccessToken();
  }
  if (!token) return { ok: false, message: "Please sign in." };
  try {
    const returnOrigin =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ returnOrigin }),
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

function readStatusCacheCount(): number {
  try {
    const raw = sessionStorage.getItem(STATUS_CACHE_KEY);
    if (!raw) return 0;
    const n = Number(JSON.parse(raw)?.used);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeStatusCacheCount(used: number) {
  try {
    sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify({ used }));
  } catch {
    /* */
  }
}

async function fetchConnectedCountForUser(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const res = await fetch(
      `/api/composio/connections?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    if (typeof data.used === "number") {
      writeStatusCacheCount(data.used);
      return data.used;
    }
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    const n = accounts.filter((a: any) =>
      /ACTIVE|CONNECTED|SUCCESS/i.test(String(a.status || ""))
    ).length;
    writeStatusCacheCount(n);
    return n;
  } catch {
    return 0;
  }
}

/**
 * Count Composio connected accounts for Settings / plan gates.
 */
export async function getConnectedExternalCount(
  userId: string,
  alternateUserIds: string[] = []
): Promise<number> {
  const ids = [userId, ...alternateUserIds]
    .map((id) => (id || "").trim())
    .filter(Boolean);
  const unique = [...new Set(ids)];

  let best = readStatusCacheCount();
  for (const id of unique) {
    const n = await fetchConnectedCountForUser(id);
    if (n > best) best = n;
  }
  return best;
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
  let token = await resolveAccessToken();
  if (!token) {
    await new Promise((r) => setTimeout(r, 400));
    token = await resolveAccessToken();
  }

  if (!token) {
    if (hasOperatorUser()) {
      return { ok: true, runsUsedThisPeriod: 0 };
    }
    return { ok: false, message: "Please sign in." };
  }

  try {
    const res = await fetch("/api/billing/record-run", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      if (
        /sign in|unauthorized|session/i.test(String(data.message || "")) &&
        hasOperatorUser()
      ) {
        return { ok: true, runsUsedThisPeriod: 0 };
      }
      return {
        ok: false,
        message: data.message || LIMIT_MESSAGES.runs,
        limitReached: Boolean(data.limitReached),
      };
    }
    clearBillingCache();
    return { ok: true, runsUsedThisPeriod: Number(data.runsUsedThisPeriod) || 0 };
  } catch {
    if (hasOperatorUser()) {
      return { ok: true, runsUsedThisPeriod: 0 };
    }
    return { ok: false, message: "Could not record run. Please try again." };
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
  const max = Math.min(
    billing.limits.maxConnections,
    MAX_COMPOSIO_CONNECTIONS
  );
  if (activeConnectionCount >= max) {
    return { ok: false, message: LIMIT_MESSAGES.connections };
  }
  return { ok: true };
}

export function canRunAgent(billing: ClientBillingState): boolean {
  return billing.runsUsedThisPeriod < billing.limits.maxRunsPerMonth;
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

export const canAddVaultBytes = canUseVault;
export const startProCheckout = startCheckout;

export { PLAN_FREE, hasProAccess, LIMIT_MESSAGES, MAX_COMPOSIO_CONNECTIONS };
