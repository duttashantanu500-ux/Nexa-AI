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
  maxConnections: number; // Infinity for unlimited
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

export const PLAN_FREE: PlanDefinition = {
  id: "free",
  name: "Free",
  priceMonthlyCents: 0,
  priceLabel: "$0/month",
  limits: {
    maxAgents: 3,
    maxConnections: 3,
    maxRunsPerMonth: 100,
    vaultBytes: 500 * 1024 * 1024, // 500 MB
    advancedWorkflow: false,
    priorityExecution: false,
  },
  features: [
    "Up to 3 agents",
    "Up to 3 connections",
    "100 agent runs per month",
    "500 MB Vault storage",
    "Scheduling",
    "Agent Builder",
    "Run history",
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
    vaultBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    advancedWorkflow: true,
    priorityExecution: true,
  },
  features: [
    "Up to 20 agents",
    "Unlimited connections",
    "1,000 agent runs per month",
    "5 GB Vault storage",
    "Scheduling",
    "Agent Builder",
    "Run history",
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

/** True when the user currently has Pro entitlements (active or canceling until period end). */
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

/** User-facing messages for limit blocks */
export const LIMIT_MESSAGES = {
  agents: "You've reached the Free plan limit of 3 agents. Upgrade to Pro for up to 20 agents.",
  connections:
    "You've reached the Free plan limit of 3 connections. Upgrade to Pro for unlimited connections.",
  runs: "You've used all agent runs for this month on the Free plan. Upgrade to Pro for 1,000 runs per month.",
  vault:
    "Your Vault is full on the Free plan (500 MB). Upgrade to Pro for 5 GB of storage.",
  advancedWorkflow:
    "Advanced workflow options are available on Pro. Upgrade to unlock them.",
  priorityExecution:
    "Priority execution is available on Pro. Upgrade to unlock it.",
} as const;
