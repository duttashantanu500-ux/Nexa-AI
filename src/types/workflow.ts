/**
 * Phase 1 aligned workflow models (NEXA_DATA_MODELS / AGENT_SYSTEM).
 * Additive — existing agents with simple steps still load.
 */

export type StepType = "action" | "approval" | "condition" | "transform";

export type StepOnError = "stop" | "continue" | "retry";

export interface StepRetryPolicy {
  maxAttempts: number;
  backoffSeconds: number;
}

/** Resolved at run time: literal or "{{stepId.output.field}}" */
export type InputMappingValue = string;

export interface WorkflowStep {
  id: string;
  order: number;
  /** Defaults to "action" for legacy steps */
  type?: StepType;
  actionId: string;
  name: string;
  /** Connector id when known */
  connectorId?: string;
  /** User connection instance id when multi-connection exists */
  connectionId?: string;
  /** Static config (legacy + form values) */
  config: Record<string, string>;
  /** Spec-style mapping; merges with config at runtime */
  inputMapping?: Record<string, InputMappingValue>;
  outputKey?: string;
  onError?: StepOnError;
  retryPolicy?: StepRetryPolicy;
  requiresApproval?: boolean;
  condition?: {
    source: string;
    operator: "eq" | "neq" | "contains" | "exists";
    value?: string;
  };
}

export type RunStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "skipped_overlap"
  | "awaiting_approval"
  | "approved"
  | "rejected";

export interface NormalizedProviderError {
  providerStatusCode?: number;
  providerMessage?: string;
  category?: "auth" | "rate_limit" | "validation" | "server_error" | "unknown" | "mapping_error";
}

export interface WorkflowStepResult {
  stepId: string;
  actionId: string;
  name: string;
  status: RunStepStatus | "succeeded" | "failed" | "skipped";
  startedAt: string;
  endedAt?: string;
  /** Human-readable summary */
  output?: string;
  /** Actual payload sent (redact secrets before persist) */
  inputSent?: Record<string, unknown>;
  /** Provider/raw response (redacted) */
  outputReceived?: unknown;
  error?: string;
  normalizedError?: NormalizedProviderError;
  retryCount?: number;
  simulated?: boolean;
}

export type WorkflowAgentStatus =
  | "draft"
  | "ready"
  | "active"
  | "paused"
  | "failed"
  | "needs_setup"
  | "archived";

export type AgentRunStatusExtended =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "succeeded"
  | "succeeded_with_errors"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export interface AgentScheduleRecord {
  id?: string;
  agentId?: string;
  type: "once" | "one_time" | "daily" | "weekly" | "monthly" | "yearly";
  timezone: string;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  runAt?: string | null;
  enabled: boolean;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  consecutiveFailures?: number;
}

/** User connection instance (metadata only on client; tokens server-side only) */
export interface ConnectionRecord {
  id: string;
  connectorId: string;
  ownerUserId: string;
  label: string;
  status: "connected" | "expired" | "revoked" | "error" | "setup_required";
  scopesGranted: string[];
  providerAccountRef?: string;
  connectedAt?: string;
  lastVerifiedAt?: string;
  /** Never store access tokens in localStorage */
  hasServerToken?: boolean;
}
