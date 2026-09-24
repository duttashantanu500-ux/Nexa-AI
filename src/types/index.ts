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
  age?: number;
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

export type ConnectionStatus =
  | "connected"
  | "not_connected"
  | "available"
  | "connecting"
  | "failed"
  | "disconnected";

export interface Connection {
  id: string;
  name: string;
  provider: string;
  status: ConnectionStatus;
  description?: string;
  mcpUrl?: string;
  mcpTools?: string[];
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
    purpose: "Finds and qualifies potential customers using web research.",
    status: "idle",
    tools: ["web_search", "web_page_reader"],
    schedule: "On demand",
    recentActivity: "Ready — run via Missions",
    isTemplate: true,
  },
  {
    name: "Competitor Monitor",
    purpose: "Researches competitor pages and public changes.",
    status: "idle",
    tools: ["web_search", "web_page_reader"],
    schedule: "On demand",
    recentActivity: "Ready — run via Missions",
    isTemplate: true,
  },
  {
    name: "Market Researcher",
    purpose: "Researches markets and opportunities from public sources.",
    status: "idle",
    tools: ["web_search", "web_page_reader"],
    schedule: "On demand",
    recentActivity: "Ready — run via Missions",
    isTemplate: true,
  },
  {
    name: "Content Researcher",
    purpose: "Finds content opportunities from public web sources.",
    status: "idle",
    tools: ["web_search", "web_page_reader"],
    schedule: "On demand",
    recentActivity: "Ready — run via Missions",
    isTemplate: true,
  },
];
