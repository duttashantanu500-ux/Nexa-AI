import {
  AppState,
  UserProfile,
  BusinessContext,
  Conversation,
  Message,
  MemoryItem,
  WorkspaceId,
} from "@/types";

const STORAGE_KEY = "nexa_app_state_v1";
const MESSAGES_KEY_PREFIX = "nexa_messages_";

const defaultState: AppState = {
  user: null,
  businessContext: null,
  memories: [],
  conversations: [],
  currentWorkspace: "strategy",
  currentConversationId: null,
  theme: "system",
};

export function loadAppState(): AppState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as AppState;
    return { ...defaultState, ...parsed };
  } catch {
    return defaultState;
  }
}

export function saveAppState(state: Partial<AppState>) {
  if (typeof window === "undefined") return;
  const current = loadAppState();
  const next = { ...current, ...state };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function loadMessages(conversationId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MESSAGES_KEY_PREFIX + conversationId);
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch {
    return [];
  }
}

export function saveMessages(conversationId: string, messages: Message[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    MESSAGES_KEY_PREFIX + conversationId,
    JSON.stringify(messages)
  );
}

export function createId(): string {
  return crypto.randomUUID();
}

// Helper to add a memory (deduplicated roughly by content)
export function addMemory(
  memories: MemoryItem[],
  content: string,
  category: string,
  importance = 7,
  source?: string
): MemoryItem[] {
  const exists = memories.some(
    (m) => m.content.toLowerCase().trim() === content.toLowerCase().trim()
  );
  if (exists) return memories;

  const newMemory: MemoryItem = {
    id: createId(),
    content,
    category,
    importance,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source,
  };

  return [...memories, newMemory].sort((a, b) => b.importance - a.importance);
}

export function getRelevantMemories(
  memories: MemoryItem[],
  limit = 12
): MemoryItem[] {
  return memories.slice(0, limit);
}
