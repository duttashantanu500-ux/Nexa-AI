export type UserType = "founder" | "business_owner" | "agency" | "individual";

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
}

/** Schedule for an agent */
export type ScheduleFrequency =
  | "once"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export interface AgentSchedule {
  frequency: ScheduleFrequency;
  time: string; // HH:mm
  timezone: string;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  enabled: boolean;
  nextRunAt?: string | null;
}

export type PermissionMode = "read" | "write" | "approval_required";

export interface AgentPermissions {
  mode: PermissionMode;
  allowDestructive: boolean;
}

export type AgentStatus = "active" | "paused" | "error";

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
  trigger: "manual" | "schedule";
  status: AgentRunStatus;
  startedAt: string;
  endedAt?: string | null;
  durationMs?: number | null;
  summary?: string;
  output?: string;
  error?: string;
  sources?: { title?: string; url: string }[];
}

export type ConnectionStatus =
  | "connected"
  | "not_connected"
  | "available"
  | "setup_required"
  | "not_supported";

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
}

/** Built-in tools that actually work without OAuth */
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
    description: "Read and extract content from public pages",
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
    description: "Email — connect later with Google OAuth",
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
    id: "gcal",
    name: "Google Calendar",
    provider: "google",
    status: "not_supported",
    description: "Calendar — not available yet",
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
    id: "notion",
    name: "Notion",
    provider: "notion",
    status: "not_supported",
    description: "Notes — not available yet",
    tools: [],
  },
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    status: "not_supported",
    description: "Code — not available yet",
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
}[] = [
  {
    id: "research",
    name: "Research Agent",
    description: "Researches topics using public web search",
    purpose: "Find and summarize public information based on your instructions",
    instructions:
      "Research the topic specified by the user. Use only public web sources. Follow the user's category and location exactly. Do not assume SaaS or software unless asked.",
    tools: ["web_search", "web_page_reader"],
    executable: true,
  },
  {
    id: "competitor",
    name: "Competitor Monitor",
    description: "Tracks public competitor pages",
    purpose: "Monitor public competitor information",
    instructions:
      "Research competitors named by the user. Report only what is found on public pages.",
    tools: ["web_search", "web_page_reader"],
    executable: true,
  },
  {
    id: "content",
    name: "Content Agent",
    description: "Finds content ideas from public sources",
    purpose: "Discover content opportunities",
    instructions:
      "Find public content ideas and sources relevant to the user's topic.",
    tools: ["web_search", "web_page_reader"],
    executable: true,
  },
  {
    id: "custom",
    name: "Custom Agent",
    description: "Define your own instructions and tools",
    purpose: "",
    instructions: "",
    tools: ["web_search", "web_page_reader"],
    executable: true,
  },
  {
    id: "email",
    name: "Email Assistant",
    description: "Requires Gmail connection",
    purpose: "Help with email workflows",
    instructions: "",
    tools: [],
    executable: false,
  },
];

export function defaultSchedule(): AgentSchedule {
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";
  return {
    frequency: "once",
    time: "09:00",
    timezone: tz,
    enabled: true,
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
    while (next.getDay() !== target || next <= now) {
      next.setDate(next.getDate() + 1);
    }
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
