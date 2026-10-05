/**
 * Server-side employee builder chat persistence (Supabase).
 */
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ChatMessageRow = {
  role: "user" | "assistant";
  content: string;
  thinking?: string[];
  at?: string;
};

export async function loadEmployeeChat(
  userId: string,
  scopeId: string
): Promise<ChatMessageRow[]> {
  const sb = adminClient();
  if (!sb || !userId || !scopeId) return [];
  const { data, error } = await sb
    .from("nexa_employee_chats")
    .select("messages")
    .eq("owner_user_id", userId)
    .eq("scope_id", scopeId)
    .maybeSingle();
  if (error) {
    console.error("loadEmployeeChat", error.message);
    return [];
  }
  const msgs = data?.messages;
  if (!Array.isArray(msgs)) return [];
  return msgs
    .filter(
      (m: any) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .map((m: any) => ({
      role: m.role,
      content: String(m.content),
      thinking: Array.isArray(m.thinking) ? m.thinking.map(String) : undefined,
      at: typeof m.at === "string" ? m.at : undefined,
    }));
}

export async function saveEmployeeChat(params: {
  userId: string;
  scopeId: string;
  messages: ChatMessageRow[];
  agentId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = adminClient();
  if (!sb) return { ok: false, error: "Server chat storage is not configured." };
  if (!params.userId || !params.scopeId) {
    return { ok: false, error: "Missing user or conversation." };
  }
  const trimmed = (params.messages || []).slice(-200).map((m) => ({
    role: m.role,
    content: String(m.content || "").slice(0, 8000),
    thinking: Array.isArray(m.thinking) ? m.thinking.slice(0, 20) : undefined,
    at: m.at || new Date().toISOString(),
  }));

  const row: Record<string, unknown> = {
    owner_user_id: params.userId,
    scope_id: params.scopeId,
    messages: trimmed,
    updated_at: new Date().toISOString(),
  };
  if (params.agentId) row.agent_id = params.agentId;

  const { error } = await sb.from("nexa_employee_chats").upsert(row, {
    onConflict: "owner_user_id,scope_id",
  });
  if (error) {
    console.error("saveEmployeeChat", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function migrateEmployeeChatScope(params: {
  userId: string;
  fromScope: string;
  toScope: string;
  agentId?: string;
}): Promise<boolean> {
  const msgs = await loadEmployeeChat(params.userId, params.fromScope);
  if (!msgs.length) return true;
  const existing = await loadEmployeeChat(params.userId, params.toScope);
  const merged = existing.length ? [...existing, ...msgs] : msgs;
  const res = await saveEmployeeChat({
    userId: params.userId,
    scopeId: params.toScope,
    messages: merged,
    agentId: params.agentId || null,
  });
  return res.ok;
}
