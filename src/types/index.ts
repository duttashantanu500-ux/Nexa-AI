export type UserType = "founder" | "business_owner" | "agency";

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
  userType: UserType;
  createdAt: string;
  onboardingCompleted: boolean;
}

export interface BusinessContext {
  name?: string;
  businessName?: string;
  industry?: string;
  subIndustry?: string;
  website?: string;
  websiteSummary?: string;
  mainGoal?: string;
  biggestChallenge?: string;
  whatBuilding?: string;
  problemSolved?: string;
  targetCustomer?: string;
  stage?: string;
  businessType?: string;
  productsServices?: string;
  targetCustomers?: string;
  location?: string;
  agencyType?: string;
  servicesOffered?: string;
  industriesServed?: string;
  targetClients?: string;
  description?: string;
  brandVoice?: string;
  preferences?: string;
}

export type MissionStatus =
  | "planning"
  | "ready"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "paused";

export interface MissionStep {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "failed";
}

export interface MissionActivity {
  id: string;
  text: string;
  at: string;
  type?: "info" | "success" | "warning";
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
  createdAt: string;
  updatedAt: string;
}

export type AgentStatus = "idle" | "active" | "paused" | "error";

export interface Agent {
  id: string;
  userId: string;
  name: string;
  purpose: string;
  instructions?: string;
  status: AgentStatus;
  tools: string[];
  schedule?: string;
  recentActivity?: string;
  isTemplate?: boolean;
  createdAt: string;
}

export type ConnectionStatus = "connected" | "not_connected";

export interface Connection {
  id: string;
  name: string;
  provider: string;
  status: ConnectionStatus;
  description?: string;
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
  createdAt: string;
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

export interface AppState {
  user: UserProfile | null;
  businessContext: BusinessContext | null;
  memories: MemoryItem[];
  conversations: Conversation[];
  currentWorkspace: WorkspaceId;
  currentConversationId: string | null;
  theme: "light" | "dark" | "system";
  missions: Mission[];
  agents: Agent[];
  connections: Connection[];
  activity: ActivityEvent[];
  approvals: ApprovalRequest[];
}

export const WORKSPACES: {
  id: WorkspaceId;
  name: string;
  emoji: string;
  description: string;
}[] = [
  { id: "marketing", name: "Marketing", emoji: "📣", description: "Acquisition and campaigns" },
  { id: "sales", name: "Sales", emoji: "💰", description: "Outreach and closing" },
  { id: "strategy", name: "Strategy", emoji: "🧠", description: "Decisions and growth" },
  { id: "content_brand", name: "Content & Brand", emoji: "✍️", description: "Copy and brand" },
  { id: "personal_growth", name: "Personal Growth", emoji: "👤", description: "Founder productivity" },
];

export const DEFAULT_CONNECTIONS: Connection[] = [
  { id: "gmail", name: "Gmail", provider: "google", status: "not_connected", description: "Email and outreach" },
  { id: "gdrive", name: "Google Drive", provider: "google", status: "not_connected", description: "Docs and files" },
  { id: "gcal", name: "Google Calendar", provider: "google", status: "not_connected", description: "Scheduling" },
  { id: "notion", name: "Notion", provider: "notion", status: "not_connected", description: "Notes and knowledge" },
  { id: "slack", name: "Slack", provider: "slack", status: "not_connected", description: "Team messaging" },
  { id: "github", name: "GitHub", provider: "github", status: "not_connected", description: "Code and issues" },
  { id: "shopify", name: "Shopify", provider: "shopify", status: "not_connected", description: "Store data" },
  { id: "airtable", name: "Airtable", provider: "airtable", status: "not_connected", description: "Structured data" },
];

export const AGENT_TEMPLATES: Omit<Agent, "id" | "userId" | "createdAt">[] = [
  {
    name: "Lead Researcher",
    purpose: "Finds and qualifies potential customers.",
    status: "idle",
    tools: ["Web Research", "Browser"],
    schedule: "On demand",
    recentActivity: "Template — not running yet",
    isTemplate: true,
  },
  {
    name: "Competitor Monitor",
    purpose: "Monitors competitors and reports meaningful changes.",
    status: "idle",
    tools: ["Web Research", "Browser"],
    schedule: "Weekly",
    recentActivity: "Template — not running yet",
    isTemplate: true,
  },
  {
    name: "Content Researcher",
    purpose: "Finds trends and content opportunities.",
    status: "idle",
    tools: ["Web Research"],
    schedule: "Weekly",
    recentActivity: "Template — not running yet",
    isTemplate: true,
  },
];
