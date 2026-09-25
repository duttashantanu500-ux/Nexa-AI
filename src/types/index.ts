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
  type: "image" | "file";
  name: string;
  url: string;
  mimeType?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  workspace: WorkspaceId;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ActivityEvent {
  id: string;
  userId: string;
  text: string;
  at: string;
  category?: "mission" | "agent" | "connection" | "approval" | "system";
  refId?: string;
}

export interface ApprovalRequest {
  id: string;
  userId: string;
  title: string;
  summary: string;
  status: "pending" | "approved" | "rejected";
  missionId?: string;
  actionId?: string;
  runId?: string;
  runStepId?: string;
  createdAt: string;
}

export type ScheduleFrequency =
  | "once"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export interface AgentSchedule {
  frequency: ScheduleFrequency;
  time: string;
  timezone: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  enabled: boolean;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  consecutiveFailures?: number;
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
} from "./workflow";

import type {
  WorkflowStep,
  WorkflowStepResult,
  WorkflowAgentStatus,
  ConnectionRecord,
} from "./workflow";

export type AgentStatus =
  | "idle"
  | "active"
  | "paused"
  | "error"
  | WorkflowAgentStatus;

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description: string;
  purpose: string;
  instructions: string;
  expectedOutput?: string;
  constraints?: string;
  templateType?: string;
  status: AgentStatus;
  /** Incremented when steps structure changes */
  version: number;
  tools: string[];
  steps: WorkflowStep[];
  permissions: AgentPermissions;
  schedule: AgentSchedule;
  lastRunAt?: string | null;
  lastRunStatus?: AgentRunStatus | null;
  createdAt: string;
  updatedAt: string;
}

export type AgentRunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "waiting_for_approval"
  | "completed"
  | "succeeded"
  | "succeeded_with_errors"
  | "partial"
  | "failed"
  | "cancelled";

export interface AgentRun {
  id: string;
  agentId: string;
  userId: string;
  /** Version of agent steps that executed */
  agentVersion?: number;
  trigger: "manual" | "schedule" | "test";
  triggerSource?: string;
  status: AgentRunStatus;
  isTest?: boolean;
  startedAt: string;
  endedAt?: string | null;
  durationMs?: number | null;
  summary?: string;
  output?: string;
  error?: string;
  sources?: { title?: string; url: string }[];
  stepResults?: WorkflowStepResult[];
  mode?: "real" | "simulated";
}

export type ConnectionStatus =
  | "connected"
  | "not_connected"
  | "available"
  | "setup_required"
  | "not_supported"
  | "connecting"
  | "failed"
  | "disconnected"
  | "expired"
  | "revoked"
  | "error";

export interface Connection {
  id: string;
  name: string;
  provider: string;
  status: ConnectionStatus;
  description?: string;
  tools?: string[];
  mcpUrl?: string;
  mcpTools?: string[];
}

export interface AppState {
  user: UserProfile | null;
  businessContext: BusinessContext | null;
  theme: "light" | "dark" | "system";
  agents: Agent[];
  agentRuns: AgentRun[];
  connections: Connection[];
  /** Phase 1: connection instances (no tokens client-side) */
  connectionRecords?: ConnectionRecord[];
  memories?: MemoryItem[];
  conversations?: Conversation[];
  currentWorkspace?: WorkspaceId;
  currentConversationId?: string | null;
  missions?: Mission[];
  activity?: ActivityEvent[];
  approvals?: ApprovalRequest[];
}

export const BUILTIN_TOOLS = [
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the public web",
    connector: "Built-in",
    available: false,
    permission: "read" as const,
  },
];

export const DEFAULT_CONNECTIONS: Connection[] = [
  {
    id: "local_data",
    name: "Local data tools",
    provider: "builtin",
    status: "connected",
    description: "Deterministic local actions",
    tools: ["local_data.list_from_text", "local_data.filter", "local_data.report"],
  },
  {
    id: "slack",
    name: "Slack",
    provider: "slack",
    status: "setup_required",
    description: "OAuth setup required",
    tools: [],
  },
  {
    id: "notion",
    name: "Notion",
    provider: "notion",
    status: "setup_required",
    description: "OAuth setup required",
    tools: [],
  },
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    status: "setup_required",
    description: "OAuth setup required",
    tools: [],
  },
];

export const AGENT_TEMPLATES: {
  id: string;
  name: string;
  description: string;
  purpose: string;
  instructions: string;
  tools: string[];
  executable: boolean;
}[] = [];

export function defaultSchedule(): AgentSchedule {
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";
  return {
    frequency: "once",
    time: "09:00",
    timezone: tz,
    enabled: false,
    nextRunAt: null,
    consecutiveFailures: 0,
  };
}

export function defaultPermissions(): AgentPermissions {
  return { mode: "read", allowDestructive: false };
}

export function computeNextRun(schedule: AgentSchedule): string | null {
  if (!schedule.enabled || schedule.frequency === "once") return null;
  const now = new Date();
  const [hh, mm] = schedule.time.split(":").map((x) => parseInt(x, 10) || 0);
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hh, mm, 0, 0);
  if (schedule.frequency === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  if (schedule.frequency === "weekly") {
    const target = schedule.dayOfWeek ?? 1;
    while (next.getDay() !== target || next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  if (schedule.frequency === "monthly") {
    const day = Math.min(schedule.dayOfMonth || 1, 28);
    next.setDate(day);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next.toISOString();
  }
  if (schedule.frequency === "yearly") {
    if (next <= now) next.setFullYear(next.getFullYear() + 1);
    return next.toISOString();
  }
  return null;
}

export function deriveAgentStatus(agent: {
  status?: string;
  steps?: WorkflowStep[];
}): AgentStatus {
  if (agent.status === "paused") return "paused";
  if (agent.status === "archived") return "archived";
  if (agent.status === "failed" || agent.status === "error") return "failed";
  if (!agent.steps?.length) return "draft";
  if (agent.status === "active" || agent.status === "ready") return agent.status as AgentStatus;
  return "ready";
}
