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
  cancelAtPeriodEnd?: boolean;
};

const EXTERNAL_PROVIDERS = ["notion", "slack", "buffer", "hubspot", "ideogram", "mcp", "vapi"] as const;
const STATUS_CACHE_KEY = "nexa_conn_status_v1";

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
    const state: ClientBillingState = {
      planId,
      planName: data.planName || plan.name,
      status: data.status || "active",
      priceLabel: data.priceLabel || plan.priceLabel,
      limits: data.limits || plan.limits,
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

function countConnectedFromStatuses(
  statuses: Record<string, { status?: string }>
): number {
  let n = 0;
  for (const p of EXTERNAL_PROVIDERS) {
    if (statuses[p]?.status === "connected") n += 1;
  }
  return n;
}

function writeStatusCache(statuses: Record<string, { status?: string }>) {
  try {
    const map: Record<string, string> = {};
    for (const p of EXTERNAL_PROVIDERS) {
      const s = statuses[p]?.status;
      if (s) map[p] = s;
    }
    if (Object.keys(map).length) {
      sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(map));
    }
  } catch {
    /* */
  }
}

function readStatusCacheCount(): number {
  try {
    const raw = sessionStorage.getItem(STATUS_CACHE_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, string>;
    let n = 0;
    for (const p of EXTERNAL_PROVIDERS) {
      if (map[p] === "connected") n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

async function fetchConnectedCountForUser(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const res = await fetch(
      `/api/connections/status?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    const statuses = (data?.statuses || {}) as Record<string, { status?: string }>;
    const n = countConnectedFromStatuses(statuses);
    if (n > 0) writeStatusCache(statuses);
    return n;
  } catch {
    return 0;
  }
}

/**
 * Count external connections for Settings / plan gates.
 * Tries primary userId then optional alternate ids (pinned vs operator mismatch).
 * Never under-reports vs session cache written by Connections list.
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
      if (/sign in|unauthorized|session/i.test(String(data.message || "")) && hasOperatorUser()) {
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

/** Alias used by vaultStore */
export const canAddVaultBytes = canUseVault;

/** Alias used by agent detail / settings pages */
export const startProCheckout = startCheckout;

export { PLAN_FREE, hasProAccess, LIMIT_MESSAGES };
