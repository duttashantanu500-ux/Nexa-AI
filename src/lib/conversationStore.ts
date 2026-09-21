/**
 * Nexa conversationStore
 * Clean client-side persistence. Ready to swap for a backend later.
 */

import {
  AppState,
  BusinessContext,
  Conversation,
  Message,
  MemoryItem,
  UserProfile,
  WorkspaceId,
} from "@/types";

const APP_KEY = "nexa_app_state_v2";
const MSG_PREFIX = "nexa_msgs_v2_";

const defaultState: AppState = {
  user: null,
  businessContext: null,
  memories: [],
  conversations: [],
  currentWorkspace: "strategy",
  currentConversationId: null,
  theme: "system",
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function loadAppState(): AppState {
  if (typeof window === "undefined") return { ...defaultState };
  try {
    // Migrate from v1 if needed
    const v2 = localStorage.getItem(APP_KEY);
    if (v2) return { ...defaultState, ...safeParse(v2, {}) };

    const v1 = localStorage.getItem("nexa_app_state_v1");
    if (v1) {
      const parsed = safeParse<AppState>(v1, defaultState);
      localStorage.setItem(APP_KEY, JSON.stringify(parsed));
      return { ...defaultState, ...parsed };
    }
    return { ...defaultState };
  } catch {
    return { ...defaultState };
  }
}

export function saveAppState(partial: Partial<AppState>): AppState {
  if (typeof window === "undefined") return { ...defaultState, ...partial };
  const current = loadAppState();
  const next = { ...current, ...partial };
  try {
    localStorage.setItem(APP_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("[Nexa] failed to save app state", err);
  }
  return next;
}

export function getConversationsByWorkspace(workspace: WorkspaceId): Conversation[] {
  const state = loadAppState();
  return (state.conversations || [])
    .filter((c) => c.workspace === workspace)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function getConversation(id: string): Conversation | null {
  const state = loadAppState();
  return state.conversations.find((c) => c.id === id) || null;
}

export function createConversation(params: {
  userId: string;
  workspace: WorkspaceId;
  title?: string;
}): Conversation {
  const conv: Conversation = {
    id: createId(),
    userId: params.userId,
    workspace: params.workspace,
    title: params.title || "New conversation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
  };

  const state = loadAppState();
  const conversations = [conv, ...(state.conversations || [])];
  saveAppState({
    conversations,
    currentConversationId: conv.id,
    currentWorkspace: params.workspace,
  });
  saveMessages(conv.id, []);
  return conv;
}

export function updateConversation(
  id: string,
  patch: Partial<Conversation>
): void {
  const state = loadAppState();
  const conversations = (state.conversations || []).map((c) =>
    c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
  );
  saveAppState({ conversations });
}

export function deleteConversation(id: string): void {
  const state = loadAppState();
  const conversations = (state.conversations || []).filter((c) => c.id !== id);
  const nextCurrent =
    state.currentConversationId === id ? null : state.currentConversationId;
  saveAppState({ conversations, currentConversationId: nextCurrent });
  try {
    localStorage.removeItem(MSG_PREFIX + id);
    localStorage.removeItem("nexa_messages_" + id); // legacy
  } catch {
    /* ignore */
  }
}

export function loadMessages(conversationId: string): Message[] {
  if (typeof window === "undefined" || !conversationId) return [];
  try {
    const v2 = localStorage.getItem(MSG_PREFIX + conversationId);
    if (v2) return safeParse<Message[]>(v2, []);

    // legacy key
    const v1 = localStorage.getItem("nexa_messages_" + conversationId);
    if (v1) {
      const msgs = safeParse<Message[]>(v1, []);
      localStorage.setItem(MSG_PREFIX + conversationId, JSON.stringify(msgs));
      return msgs;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveMessages(conversationId: string, messages: Message[]): void {
  if (typeof window === "undefined" || !conversationId) return;
  try {
    localStorage.setItem(MSG_PREFIX + conversationId, JSON.stringify(messages));
  } catch (err) {
    console.error("[Nexa] failed to save messages", err);
  }
}

export function addMessage(conversationId: string, message: Message): Message[] {
  const current = loadMessages(conversationId);
  // Prevent duplicate by id or requestId+role
  if (current.some((m) => m.id === message.id)) return current;
  if (
    message.requestId &&
    current.some(
      (m) => m.requestId === message.requestId && m.role === message.role
    )
  ) {
    return current;
  }
  const next = [...current, message];
  saveMessages(conversationId, next);
  updateConversation(conversationId, { messageCount: next.length });
  return next;
}

export function updateMessage(
  conversationId: string,
  messageId: string,
  patch: Partial<Message>
): Message[] {
  const current = loadMessages(conversationId);
  const next = current.map((m) =>
    m.id === messageId ? { ...m, ...patch } : m
  );
  saveMessages(conversationId, next);
  return next;
}

export function hasAssistantForRequest(
  conversationId: string,
  requestId: string
): boolean {
  return loadMessages(conversationId).some(
    (m) => m.role === "assistant" && m.requestId === requestId
  );
}

export function generateConversationTitle(firstUserMessage: string): string {
  const cleaned = (firstUserMessage || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "New conversation";

  // Strip URLs for cleaner titles
  const noUrl = cleaned.replace(/https?:\/\/\S+/gi, "").trim();
  const source = noUrl || cleaned;

  const words = source.split(" ").filter(Boolean).slice(0, 6);
  let title = words.join(" ");
  if (title.length > 48) title = title.slice(0, 45).trim() + "…";
  if (!title) return "New conversation";

  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

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

  const item: MemoryItem = {
    id: createId(),
    content,
    category,
    importance,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source,
  };
  return [...memories, item].sort((a, b) => b.importance - a.importance);
}

export function getRelevantMemories(
  memories: MemoryItem[],
  limit = 12
): MemoryItem[] {
  return (memories || []).slice(0, limit);
}

export function updateBusinessContext(
  patch: Partial<BusinessContext>
): BusinessContext {
  const state = loadAppState();
  const next = { ...(state.businessContext || {}), ...patch };
  saveAppState({ businessContext: next });
  return next;
}

// Back-compat exports used by older pages
export { loadAppState as loadAppStateCompat };
