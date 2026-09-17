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
  // Common
  name?: string; // what Nexa should call them
  age?: string;
  businessName?: string;
  industry?: string;
  subIndustry?: string;
  website?: string;
  mainGoal?: string;
  biggestChallenge?: string;

  // Founder specific
  whatBuilding?: string;
  problemSolved?: string;
  targetCustomer?: string;
  stage?: string;

  // Business Owner specific
  businessType?: string;
  productsServices?: string;
  targetCustomers?: string;
  location?: string;

  // Agency specific
  agencyType?: string;
  servicesOffered?: string;
  industriesServed?: string;
  targetClients?: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  category: string; // e.g. "positioning", "target_customer", "goal", "brand_voice"
  importance: number; // 1-10
  createdAt: string;
  updatedAt: string;
  source?: string; // conversation id or "onboarding"
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  requestId?: string; // for deduplication
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  type: "image" | "file";
  name: string;
  url: string; // data URL or path
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
}

export const WORKSPACES: {
  id: WorkspaceId;
  name: string;
  emoji: string;
  description: string;
}[] = [
  {
    id: "marketing",
    name: "Marketing",
    emoji: "📣",
    description: "Acquisition, campaigns, SEO, social, positioning",
  },
  {
    id: "sales",
    name: "Sales",
    emoji: "💰",
    description: "Outreach, messaging, funnels, closing",
  },
  {
    id: "strategy",
    name: "Strategy",
    emoji: "🧠",
    description: "Business models, pricing, growth, decisions",
  },
  {
    id: "content_brand",
    name: "Content & Brand",
    emoji: "✍️",
    description: "Posts, copy, brand voice, content systems",
  },
  {
    id: "personal_growth",
    name: "Personal Growth",
    emoji: "👤",
    description: "Productivity, mindset, focus, professional growth",
  },
];
