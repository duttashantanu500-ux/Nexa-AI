/**
 * Workflow models aligned to NEXA_DATA_MODELS / AGENT_SYSTEM.
 */

export type StepType = "action" | "approval" | "condition" | "transform";

export type StepOnError = "stop" | "continue" | "retry";

export interface StepRetryPolicy {
  maxAttempts: number;
  backoffSeconds: number;
}

export type InputMappingValue = string;

export interface WorkflowStep {
  id: string;
  order: number;
  type?: StepType;
  actionId: string;
  name: string;
  connectorId?: string;
  connectionId?: string;
  config: Record<string, string>;
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
  category?:
    | "auth"
    | "rate_limit"
    | "validation"
    | "server_error"
    | "unknown"
    | "mapping_error"
    | "not_configured";
}

export interface WorkflowStepResult {
  stepId: string;
  actionId: string;
  name: string;
  status: RunStepStatus | "succeeded" | "failed" | "skipped";
  startedAt: string;
  endedAt?: string;
  output?: string;
  inputSent?: Record<string, unknown>;
  outputReceived?: unknown;
  error?: string;
  normalizedError?: NormalizedProviderError;
  retryCount?: number;
  simulated?: boolean;
}

export interface WorkflowContextSnapshot {
  list?: string[];
  notes?: string[];
  report?: string;
  imageUrl?: string;
  vars?: Record<string, string>;
  sources?: { title?: string; url: string }[];
  stepOutputs?: Record<string, unknown>;
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
  hasServerToken?: boolean;
}
