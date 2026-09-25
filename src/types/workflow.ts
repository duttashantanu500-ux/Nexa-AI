export interface WorkflowStep {
  id: string;
  order: number;
  actionId: string;
  name: string;
  config: Record<string, string>;
}

export interface WorkflowStepResult {
  stepId: string;
  actionId: string;
  name: string;
  status: "succeeded" | "failed" | "skipped";
  startedAt: string;
  endedAt?: string;
  output?: string;
  error?: string;
  simulated?: boolean;
}

export type WorkflowAgentStatus =
  | "draft"
  | "ready"
  | "active"
  | "paused"
  | "failed"
  | "needs_setup";
