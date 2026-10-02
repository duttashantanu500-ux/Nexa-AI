/**
 * Free / Pro plan definitions for Nexa.
 * Source of truth for limits and feature flags.
 */

export type PlanId = "free" | "pro";

export type PlanLimits = {
  maxAgents: number;
  maxConnections: number;
  maxRunsPerMonth: number;
  vaultBytes: number;
  advancedWorkflows: boolean;
  priorityExecution: boolean;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceMonthlyUsd: number;
  limits: PlanLimits;
  features: string[];
};

export const PLAN_FREE: PlanDefinition = {
  id: "free",
  name: "Free",
  priceMonthlyUsd: 0,
  limits: {
    maxAgents: 3,
    maxConnections: 3,
    maxRunsPerMonth: 100,
    vaultBytes: 500 * 1024 * 1024,
    advancedWorkflows: false,
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
  priceMonthlyUsd: 9,
  limits: {
    maxAgents: 20,
    maxConnections: 9999,
    maxRunsPerMonth: 1000,
    vaultBytes: 5 * 1024 * 1024 * 1024,
    advancedWorkflows: true,
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

export function getPlan(id: PlanId | string | null | undefined): PlanDefinition {
  if (id === "pro") return PLAN_PRO;
  return PLAN_FREE;
}

export const LIMIT_MESSAGES = {
  agents:
    "You've reached the Free plan limit of 3 AI employees. Upgrade to Pro for up to 20 AI employees.",
  connections:
    "You've reached the Free plan limit of 3 connections. Upgrade to Pro for unlimited connections.",
  runs: "You've used all work runs for this month on the Free plan. Upgrade to Pro for 1,000 runs per month.",
  vault:
    "Your Vault is full on the Free plan (500 MB). Upgrade to Pro for 5 GB of storage.",
  advancedWorkflows:
    "Advanced workflow options are available on Pro. Upgrade to unlock them.",
  priorityExecution:
    "Priority execution is available on Pro. Upgrade to unlock it.",
} as const;
