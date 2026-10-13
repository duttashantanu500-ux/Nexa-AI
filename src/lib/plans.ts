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
    "Up to 3 AI employees",
    "Up to 3 connections",
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
    vaultBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    advancedWorkflow: true,
    priorityExecution: true,
  },
  features: [
    "Up to 20 AI employees",
    "Unlimited connections",
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

/** User-facing messages for limit blocks (shown with UpgradeLimitModal) */
export const LIMIT_MESSAGES = {
  agents:
    "Uh oh — you don't have enough space for another AI employee. Unlock more by upgrading to Pro.",
  connections:
    "Uh oh — you don't have enough space for another connection. Unlock more by upgrading to Pro.",
  runs: "Uh oh — you've used all work runs for this month. Unlock more by upgrading to Pro.",
  vault:
    "Uh oh — your Vault is full. Unlock more storage by upgrading to Pro.",
  advancedWorkflow:
    "Uh oh — advanced workflow options need Pro. Unlock them by upgrading.",
  priorityExecution:
    "Uh oh — priority execution needs Pro. Unlock it by upgrading.",
} as const;

export type LimitKind = keyof typeof LIMIT_MESSAGES;
