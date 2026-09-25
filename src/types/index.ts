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
} from "./workflow";

import type { WorkflowStep, WorkflowStepResult, WorkflowAgentStatus } from "./workflow";

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
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export interface AgentRun {
  id: string;
  agentId: string;
  userId: string;
  trigger: "manual" | "schedule" | "test";
  status: AgentRunStatus;
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
  | "disconnected";

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
    available: true,
    permission: "read" as const,
  },
  {
    id: "web_page_reader",
    name: "Page Reader",
    description: "Read public pages",
    connector: "Built-in",
    available: true,
    permission: "read" as const,
  },
];

export const DEFAULT_CONNECTIONS: Connection[] = [
  {
    id: "web",
    name: "Web Research",
    provider: "builtin",
    status: "connected",
    description: "Search and read public web pages",
    tools: ["web_search", "web_page_reader"],
  },
  {
    id: "gmail",
    name: "Gmail",
    provider: "google",
    status: "not_supported",
    description: "Email — not available yet",
    tools: [],
  },
  {
    id: "gdrive",
    name: "Google Drive",
    provider: "google",
    status: "not_supported",
    description: "Files — not available yet",
    tools: [],
  },
  {
    id: "slack",
    name: "Slack",
    provider: "slack",
    status: "not_supported",
    description: "Messaging — not available yet",
    tools: [],
  },
  {
    id: "mcp",
    name: "Custom MCP",
    provider: "mcp",
    status: "available",
    description: "Connect a custom MCP server",
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
  if (agent.status === "failed" || agent.status === "error") return "failed";
  if (!agent.steps?.length) return "draft";
  const hasEmptyRequired = false;
  if (hasEmptyRequired) return "needs_setup";
  if (agent.status === "active" || agent.status === "ready") return agent.status as AgentStatus;
  return "ready";
}
