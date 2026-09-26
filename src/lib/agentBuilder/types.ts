/** Proposed agent from the Agent Builder (not yet persisted). */

export interface ProposedStep {
  actionId: string;
  name?: string;
  config?: Record<string, string>;
  requiresApproval?: boolean;
  onError?: "stop" | "continue" | "retry";
}

export interface ProposedSchedule {
  frequency: "once" | "daily" | "weekly" | "monthly";
  time?: string;
  timezone?: string;
  enabled?: boolean;
}

export interface AgentProposal {
  name: string;
  description: string;
  purpose?: string;
  trigger: "manual" | "schedule";
  schedule: ProposedSchedule;
  steps: ProposedStep[];
  notes?: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  actionId?: string;
}

export interface ValidatedProposal {
  proposal: AgentProposal;
  issues: ValidationIssue[];
  canActivate: boolean;
  canDraft: boolean;
  requiredConnectors: {
    id: string;
    name: string;
    status: string;
  }[];
  approvalSteps: string[];
}

export type BuilderMessageRole = "user" | "assistant" | "system";

export interface BuilderChatMessage {
  role: BuilderMessageRole;
  content: string;
}
