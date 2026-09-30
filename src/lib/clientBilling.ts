/**
 * Client-side billing helpers (no secrets).
 * Plan status is loaded from /api/billing/status when signed in.
 */

import { getSupabase } from "./supabase";
import {
  PLAN_FREE,
  PLAN_PRO,
  type PlanId,
  type PlanLimits,
  type SubscriptionStatus,
  getPlan,
  hasProAccess,
  LIMIT_MESSAGES,
} from "./plans";

export interface ClientBillingState {
  planId: PlanId;
  planName: string;
  status: SubscriptionStatus;
  priceLabel: string;
  limits: PlanLimits;
  features: string[];
  runsUsedThisPeriod: number;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  loaded: boolean;
}

const cache: { state: ClientBillingState | null; at: number } = {
  state: null,
  at: 0,
};

const EXTERNAL_PROVIDERS = ["notion", "slack", "buffer", "ideogram", "mcp"] as const;

function freeState(): ClientBillingState {
  return {
    planId: "free",
    planName: PLAN_FREE.name,
    status: "free",
    priceLabel: PLAN_FREE.priceLabel,
    limits: PLAN_FREE.limits,
    features: PLAN_FREE.features,
    runsUsedThisPeriod: 0,
    periodEnd: null,
    cancelAtPeriodEnd: false,
    loaded: false,
  };
}

/**
 * Resolve a valid access token for the currently signed-in Nexa user.
 * Tries getSession → refresh → getUser → password recovery from nexa_auth.
 */
async function resolveAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  // 1) Existing session
  try {
    const { data } = await sb.auth.getSession();
    if (data.session?.access_token) {
      // Validate token is still accepted
      const { error } = await sb.auth.getUser(data.session.access_token);
      if (!error) return data.session.access_token;
    }
  } catch {
    /* continue */
  }

  // 2) Refresh
  try {
    const { data, error } = await sb.auth.refreshSession();
    if (!error && data.session?.access_token) return data.session.access_token;
  } catch {
    /* continue */
  }

  // 3) getUser may refresh internally when cookies exist
  try {
    const { data } = await sb.auth.getUser();
    if (data.user) {
      const { data: sess } = await sb.auth.getSession();
      if (sess.session?.access_token) return sess.session.access_token;
    }
  } catch {
    /* continue */
  }

  // 4) Email/password recovery for same account (not a new user)
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("nexa_auth");
      if (raw) {
        const parsed = JSON.parse(raw) as { email?: string; password?: string };
        const email = (parsed.email || "").trim().toLowerCase();
        const password = parsed.password || "";
        if (email && password) {
          const { data, error } = await sb.auth.signInWithPassword({
            email,
            password,
          });
          if (!error && data.session?.access_token) {
            return data.session.access_token;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

export async function fetchBillingStatus(
  force = false
): Promise<ClientBillingState> {
  if (!force && cache.state && Date.now() - cache.at < 30_000) {
    return cache.state;
  }

  const sb = getSupabase();
  if (!sb) {
    const s = freeState();
    s.loaded = true;
    cache.state = s;
    cache.at = Date.now();
    return s;
  }

  const token = await resolveAccessToken();
  if (!token) {
    const s = freeState();
    s.loaded = true;
    cache.state = s;
    cache.at = Date.now();
    return s;
  }

  try {
    const res = await fetch("/api/billing/status", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.ok) {
      const s = freeState();
      s.loaded = true;
      return s;
    }

    const planId = (data.planId === "pro" ? "pro" : "free") as PlanId;
    const plan = getPlan(planId);
    const state: ClientBillingState = {
      planId,
      planName: data.planName || plan.name,
      status: (data.status || "free") as SubscriptionStatus,
      priceLabel: data.priceLabel || plan.priceLabel,
      limits: {
        maxAgents: data.limits?.maxAgents ?? plan.limits.maxAgents,
        maxConnections:
          data.limits?.maxConnections == null
            ? Number.POSITIVE_INFINITY
            : data.limits.maxConnections,
        maxRunsPerMonth:
          data.limits?.maxRunsPerMonth ?? plan.limits.maxRunsPerMonth,
        vaultBytes: data.limits?.vaultBytes ?? plan.limits.vaultBytes,
        advancedWorkflow: Boolean(data.limits?.advancedWorkflow),
        priorityExecution: Boolean(data.limits?.priorityExecution),
      },
      features: data.features || plan.features,
      runsUsedThisPeriod: data.runsUsedThisPeriod || 0,
      periodEnd: data.periodEnd || null,
      cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
      loaded: true,
    };
    cache.state = state;
    cache.at = Date.now();
    return state;
  } catch {
    const s = freeState();
    s.loaded = true;
    return s;
  }
}

export function clearBillingCache() {
  cache.state = null;
  cache.at = 0;
}

export async function startProCheckout(): Promise<
  { ok: true; checkoutUrl: string } | { ok: false; message: string }
> {
  const sb = getSupabase();
  if (!sb) {
    return {
      ok: false,
      message: "Billing is not available right now. Please try again later.",
    };
  }

  const token = await resolveAccessToken();
  if (!token) {
    return {
      ok: false,
      message:
        "Please sign in again to upgrade. Your session could not be verified.",
    };
  }

  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        returnOrigin:
          typeof window !== "undefined" ? window.location.origin : undefined,
      }),
    });
    const data = await res.json();
    if (!data.ok || !data.checkoutUrl) {
      if (res.status === 401) {
        return {
          ok: false,
          message:
            "Please sign in again to upgrade. Your session could not be verified.",
        };
      }
      return {
        ok: false,
        message: data.message || "We couldn't start checkout. Please try again.",
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
  let n = 0;
  await Promise.all(
    EXTERNAL_PROVIDERS.map(async (p) => {
      try {
        const res = await fetch(
          `/api/connections/${p}/status?userId=${encodeURIComponent(userId)}`
        );
        const data = await res.json();
        if (data?.status === "connected") n += 1;
      } catch {
        /* ignore */
      }
    })
  );
  return n;
}

export async function assertCanConnect(
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const billing = await fetchBillingStatus(true);
  const count = await getConnectedExternalCount(userId);
  return canConnectService(count, billing);
}

export async function recordAgentRun(): Promise<
  { ok: true; runsUsedThisPeriod: number } | { ok: false; message: string; limitReached?: boolean }
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
    return { ok: false, message: "Could not record run." };
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

export function canAddVaultBytes(
  usedBytes: number,
  addBytes: number,
  billing: ClientBillingState
): { ok: true } | { ok: false; message: string } {
  if (usedBytes + addBytes > billing.limits.vaultBytes) {
    return { ok: false, message: LIMIT_MESSAGES.vault };
  }
  return { ok: true };
}

export { PLAN_FREE, PLAN_PRO, hasProAccess, LIMIT_MESSAGES };
