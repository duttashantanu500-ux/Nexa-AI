export type UserType = "founder" | "business_owner" | "agency" | "individual";

export type WorkspaceId =
  | "marketing"
  | "sales"
  | "strategy"
  | "content_brand"
  | "personal_growth";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  age?: number;
  userType?: UserType;
  createdAt: string;
  onboardingCompleted: boolean;
}

export interface BusinessContext {
  name?: string;
  businessName?: string;
  industry?: string;
  website?: string;
  websiteSummary?: string;
  mainGoal?: string;
  description?: string;
  [key: string]: unknown;
}

export type MissionStatus =
  | "planning"
  | "ready"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "paused"
  | "cancelled";

export interface MissionStep {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  tool?: string;
}

export interface MissionActivity {
  id: string;
  text: string;
  at: string;
  type?: "info" | "success" | "warning";
}

export interface MissionSource {
  title?: string;
  url: string;
}

export interface ProspectRow {
  company: string;
  website: string;
  reason: string;
  evidence: string;
  source: string;
  qualification?: "qualified" | "discovered" | "unverified";
}

export interface MissionDeliverable {
  type: string;
  title: string;
  content: string;
  rows?: ProspectRow[];
  discovered?: ProspectRow[];
  qualified?: ProspectRow[];
  unverified?: ProspectRow[];
  sources: MissionSource[];
  createdAt: string;
}

export interface Mission {
  id: string;
  userId: string;
  title: string;
  goal: string;
  status: MissionStatus;
  progress: number;
  plan: MissionStep[];
  activity: MissionActivity[];
  result?: string;
  deliverable?: MissionDeliverable;
  tools?: string[];
  researchQuery?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  category: string;
  importance: number;
  createdAt: string;
  updatedAt: string;
  source?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  requestId?: string;
  status?: "sending" | "complete" | "error";
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  workspaceId: WorkspaceId;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export type PermissionMode = "read" | "write" | "approval_required";

export interface AgentPermissions {
  mode: PermissionMode;
  allowDestructive: boolean;
}

export type {
  WorkflowStep,
  WorkflowStepResult,
  WorkflowAgentStatus,
  StepType,
  ConnectionRecord,
  AgentRunStatusExtended,
  RunStepStatus,
  NormalizedProviderError,
} from "./workflow";

import type {
  WorkflowStep,
  WorkflowStepResult,
  WorkflowAgentStatus,
  ConnectionRecord,
  WorkflowContextSnapshot,
} from "./workflow";

export type AgentStatus =
  | "idle"
  | "active"
  | "paused"
  | "error"
  | WorkflowAgentStatus;

export interface AgentDefinition {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: AgentStatus;
  steps: WorkflowStep[];
  permissions?: AgentPermissions;
  schedule?: AgentScheduleRecordLike;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  connectionIds?: string[];
}

export interface AgentScheduleRecordLike {
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

export interface AgentRun {
  id: string;
  agentId: string;
  userId: string;
  status: AgentRunStatusExtended;
  startedAt: string;
  endedAt?: string;
  steps?: WorkflowStepResult[];
  stepResults?: WorkflowStepResult[];
  output?: string;
  error?: string;
  context?: WorkflowContextSnapshot;
  simulated?: boolean;
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  runId: string;
  stepId: string;
  userId: string;
  summary: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
}

export type {
  WorkflowContextSnapshot,
};
