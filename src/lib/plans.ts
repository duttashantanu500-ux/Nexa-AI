/**
 * Nexa plan definitions — Free + Pro only.
 * Source of truth for limits and feature flags.
 */

export type PlanId = "free" | "pro";

export type SubscriptionStatus =
  | "free"
  | "active"
  | "canceling"
  | "past_due"
  | "on_hold"
  | "expired"
  | "failed";

export interface PlanLimits {
  maxAgents: number;
  maxConnections: number;
  maxRunsPerMonth: number;
  vaultBytes: number;
  advancedWorkflow: boolean;
  priorityExecution: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMonthlyCents: number;
  priceLabel: string;
  limits: PlanLimits;
  features: string[];
}

/** Free-plan connection slots (Composio-connected accounts). */
export const MAX_FREE_CONNECTIONS = 5;

/** @deprecated use plan-aware limits; kept for older imports */
export const MAX_COMPOSIO_CONNECTIONS = MAX_FREE_CONNECTIONS;

export const PLAN_FREE: PlanDefinition = {
  id: "free",
  name: "Free",
  priceMonthlyCents: 0,
  priceLabel: "$0/month",
  limits: {
    maxAgents: 3,
    maxConnections: MAX_FREE_CONNECTIONS,
    maxRunsPerMonth: 100,
    vaultBytes: 500 * 1024 * 1024,
    advancedWorkflow: false,
    priorityExecution: false,
  },
  features: [
    "Up to 3 AI employees",
    "Up to 5 app connections",
    "100 work runs per month",
    "500 MB Vault storage",
    "Scheduling",
    "AI Employee Builder",
    "Work history",
  ],
};

export const PLAN_PRO: PlanDefinition = {
  id: "pro",
  name: "Pro",
  priceMonthlyCents: 900,
  priceLabel: "$9/month",
  limits: {
    maxAgents: 20,
    maxConnections: Number.POSITIVE_INFINITY,
    maxRunsPerMonth: 1000,
    vaultBytes: 5 * 1024 * 1024 * 1024,
    advancedWorkflow: true,
    priorityExecution: true,
  },
  features: [
    "Up to 20 AI employees",
    "Unlimited app connections",
    "1,000 work runs per month",
    "5 GB Vault storage",
    "Scheduling",
    "AI Employee Builder",
    "Work history",
    "Advanced workflow options",
    "Priority execution",
  ],
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: PLAN_FREE,
  pro: PLAN_PRO,
};

export function getPlan(id: PlanId | string | null | undefined): PlanDefinition {
  if (id === "pro") return PLAN_PRO;
  return PLAN_FREE;
}

export function hasProAccess(status: SubscriptionStatus | string | null | undefined): boolean {
  return status === "active" || status === "canceling" || status === "past_due";
}

export function effectivePlanId(
  status: SubscriptionStatus | string | null | undefined
): PlanId {
  return hasProAccess(status) ? "pro" : "free";
}

export function formatBytesLimit(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  return `${bytes} B`;
}

export const LIMIT_MESSAGES = {
  agents:
    "You’ve reached your AI employee limit. Upgrade to Pro for more seats.",
  connections:
    "You’ve used all connection slots on Free (5). Disconnect one or upgrade to Pro for unlimited connections.",
  runs: "You’ve used all work runs for this month. Upgrade to Pro for more.",
  vault: "Your Vault is full. Upgrade to Pro for more storage.",
  advancedWorkflow: "Advanced workflow options need Pro.",
  priorityExecution: "Priority execution needs Pro.",
} as const;

export type LimitKind = keyof typeof LIMIT_MESSAGES;
