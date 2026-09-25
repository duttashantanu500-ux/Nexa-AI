/**
 * Canonical run status mapping (NEXA_AGENT_SYSTEM §8).
 */

import type { AgentRunStatus } from "@/types";
import type { WorkflowRunResult } from "./workflowEngine";

export type CanonicalRunStatus =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "succeeded"
  | "succeeded_with_errors"
  | "failed"
  | "cancelled";

export function mapWorkflowResultToRunStatus(
  result: WorkflowRunResult
): AgentRunStatus {
  if (result.status === "completed" && result.ok) return "succeeded";
  if (result.status === "succeeded_with_errors") return "succeeded_with_errors";
  if (result.status === "partial") return "succeeded_with_errors";
  if (result.status === "failed") return "failed";
  return result.ok ? "succeeded" : "failed";
}

export function runStatusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: "Queued",
    running: "Running",
    waiting_for_approval: "Waiting for approval",
    waiting_approval: "Waiting for approval",
    succeeded: "Succeeded",
    completed: "Succeeded",
    succeeded_with_errors: "Succeeded with errors",
    partial: "Succeeded with errors",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return map[status] || status;
}

export function runStatusTone(
  status: string
): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "succeeded":
    case "completed":
      return "success";
    case "succeeded_with_errors":
    case "partial":
      return "warning";
    case "failed":
    case "cancelled":
      return "danger";
    case "running":
    case "queued":
    case "waiting_for_approval":
    case "waiting_approval":
      return "info";
    default:
      return "neutral";
  }
}

export function statusBadgeClass(status: string): string {
  const tone = runStatusTone(status);
  const base = "rounded-full px-2.5 py-0.5 text-[11px] font-medium";
  switch (tone) {
    case "success":
      return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300`;
    case "warning":
      return `${base} bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200`;
    case "danger":
      return `${base} bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300`;
    case "info":
      return `${base} bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300`;
    default:
      return `${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`;
  }
}
