import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  loadAppState,
  saveAppState,
  saveMessages,
  loadMessages,
  createId,
} from "./conversationStore";
import {
  UserProfile,
  BusinessContext,
  Conversation,
  Message,
  MemoryItem,
  UserType,
  WorkspaceId,
} from "@/types";

export { isSupabaseConfigured };

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  name: string;
}): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured." };

  const { data, error } = await sb.auth.signUp({
    email: params.email.trim().toLowerCase(),
    password: params.password,
    options: {
      data: { name: params.name.trim() },
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Could not create account." };

  // Upsert profile
  await sb.from("profiles").upsert({
    id: data.user.id,
    email: data.user.email,
    name: params.name.trim(),
    onboarding_completed: false,
  });

  const user: UserProfile = {
    id: data.user.id,
    email: (data.user.email || params.email).toLowerCase(),
    name: params.name.trim(),
    userType: "founder",
    createdAt: new Date().toISOString(),
    onboardingCompleted: false,
  };

  saveAppState({
    user,
    businessContext: null,
    memories: [],
    conversations: [],
    currentConversationId: null,
  });

  return {};
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
}): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured." };

  const { data, error } = await sb.auth.signInWithPassword({
    email: params.email.trim().toLowerCase(),
    password: params.password,
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Login failed." };

  await hydrateLocalFromCloud(data.user.id);
  return {};
}

export async function signInWithGoogle(): Promise<{ error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: "Supabase is not configured." };

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error) return { error: error.message };
  return {};
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

export async function getSessionUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id || null;
}

export async function hydrateLocalFromCloud(userId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const { data: profile } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const { data: biz } = await sb
    .from("business_contexts")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: convs } = await sb
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const { data: mems } = await sb
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .order("importance", { ascending: false });

  const user: UserProfile = {
    id: userId,
    email: profile?.email || "",
    name: profile?.name || "",
    userType: (profile?.user_type as UserType) || "founder",
    createdAt: profile?.created_at || new Date().toISOString(),
    onboardingCompleted: Boolean(profile?.onboarding_completed),
  };

  const conversations: Conversation[] = (convs || []).map((c: any) => ({
    id: c.id,
    userId: c.user_id,
    workspace: c.workspace as WorkspaceId,
    title: c.title,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    messageCount: c.message_count || 0,
  }));

  const memories: MemoryItem[] = (mems || []).map((m: any) => ({
    id: m.id,
    content: m.content,
    category: m.category || "general",
    importance: m.importance || 5,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    source: m.source,
  }));

  saveAppState({
    user,
    businessContext: (biz?.data as BusinessContext) || null,
    conversations,
    memories,
    currentConversationId: conversations[0]?.id || null,
    currentWorkspace: conversations[0]?.workspace || "strategy",
  });

  // Load messages for each conversation (limit recent)
  for (const c of conversations.slice(0, 30)) {
    const { data: msgs } = await sb
      .from("messages")
      .select("*")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true });

    const mapped: Message[] = (msgs || []).map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      requestId: m.request_id || undefined,
      status: m.status || undefined,
      attachments: m.attachments || undefined,
    }));
    saveMessages(c.id, mapped);
  }
}

export async function syncProfileToCloud(user: UserProfile): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("profiles").upsert({
    id: user.id,
    email: user.email,
    name: user.name,
    user_type: user.userType,
    onboarding_completed: user.onboardingCompleted,
    updated_at: new Date().toISOString(),
  });
}

export async function syncBusinessContextToCloud(
  userId: string,
  context: BusinessContext
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("business_contexts").upsert({
    user_id: userId,
    data: context,
    updated_at: new Date().toISOString(),
  });
}

export async function syncConversationToCloud(conv: Conversation): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("conversations").upsert({
    id: conv.id,
    user_id: conv.userId,
    workspace: conv.workspace,
    title: conv.title,
    message_count: conv.messageCount,
    created_at: conv.createdAt,
    updated_at: conv.updatedAt,
  });
}

export async function syncMessageToCloud(
  userId: string,
  message: Message
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("messages").upsert({
    id: message.id,
    conversation_id: message.conversationId,
    user_id: userId,
    role: message.role,
    content: message.content,
    request_id: message.requestId || null,
    status: message.status || null,
    attachments: message.attachments || null,
    created_at: message.createdAt,
  });
}

export async function syncMemoriesToCloud(
  userId: string,
  memories: MemoryItem[]
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  if (!memories.length) return;
  const rows = memories.map((m) => ({
    id: m.id,
    user_id: userId,
    content: m.content,
    category: m.category,
    importance: m.importance,
    source: m.source || null,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  }));
  await sb.from("memories").upsert(rows);
}

/** After local onboarding completes */
export async function persistOnboardingCloud(params: {
  user: UserProfile;
  businessContext: BusinessContext;
  memories: MemoryItem[];
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await syncProfileToCloud(params.user);
  await syncBusinessContextToCloud(params.user.id, params.businessContext);
  await syncMemoriesToCloud(params.user.id, params.memories);
}
