/**
 * Persistent AI Employee Builder chat — one conversation per draft/employee.
 * Local cache for instant UI; server sync when signed in (multi-device).
 * Full history stays in UI; the AI API only receives a recent window + summary.
 */
import { getSupabase } from "../supabase";

const KEY_PREFIX = "nexa_employee_builder_chat_v1:";

export type BuilderLine = {
  role: "user" | "assistant";
  content: string;
  thinking?: string[];
  at?: string;
};

function key(scopeId: string) {
  return KEY_PREFIX + scopeId;
}

async function authHeader(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) return {};
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    /* */
  }
  return {};
}

export function loadBuilderChat(scopeId: string): BuilderLine[] {
  if (typeof window === "undefined" || !scopeId) return [];
  try {
    const raw = localStorage.getItem(key(scopeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .map((m) => ({
        role: m.role,
        content: String(m.content),
        thinking: Array.isArray(m.thinking) ? m.thinking.map(String) : undefined,
        at: typeof m.at === "string" ? m.at : undefined,
      }));
  } catch {
    return [];
  }
}

export function saveBuilderChat(scopeId: string, lines: BuilderLine[]): void {
  if (typeof window === "undefined" || !scopeId) return;
  try {
    localStorage.setItem(key(scopeId), JSON.stringify(lines.slice(-200)));
  } catch {
    /* quota */
  }
  void syncBuilderChatToServer(scopeId, lines);
}

export async function fetchBuilderChatFromServer(
  scopeId: string
): Promise<BuilderLine[] | null> {
  const headers = await authHeader();
  if (!headers.Authorization) return null;
  try {
    const res = await fetch(
      `/api/employee-chat?scopeId=${encodeURIComponent(scopeId)}`,
      { headers, cache: "no-store" }
    );
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.messages)) return null;
    return data.messages as BuilderLine[];
  } catch {
    return null;
  }
}

export async function syncBuilderChatToServer(
  scopeId: string,
  lines: BuilderLine[],
  agentId?: string
): Promise<void> {
  const headers = await authHeader();
  if (!headers.Authorization) return;
  try {
    await fetch("/api/employee-chat", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeId,
        messages: lines.slice(-200),
        agentId: agentId || undefined,
      }),
    });
  } catch {
    /* offline */
  }
}

export async function migrateBuilderChatServer(
  fromScope: string,
  toScope: string,
  agentId?: string
): Promise<void> {
  const headers = await authHeader();
  if (!headers.Authorization) return;
  try {
    await fetch("/api/employee-chat", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        migrateFrom: fromScope,
        migrateTo: toScope,
        agentId,
      }),
    });
  } catch {
    /* */
  }
}

export function migrateBuilderChat(fromScope: string, toScope: string): void {
  if (!fromScope || !toScope || fromScope === toScope) return;
  const lines = loadBuilderChat(fromScope);
  if (!lines.length) return;
  const existing = loadBuilderChat(toScope);
  const merged = existing.length ? [...existing, ...lines] : lines;
  try {
    localStorage.setItem(key(toScope), JSON.stringify(merged.slice(-200)));
    localStorage.removeItem(key(fromScope));
  } catch {
    /* */
  }
  void migrateBuilderChatServer(fromScope, toScope);
}

export async function loadBuilderChatHydrated(scopeId: string): Promise<BuilderLine[]> {
  const local = loadBuilderChat(scopeId);
  const remote = await fetchBuilderChatFromServer(scopeId);
  if (remote && remote.length >= local.length) {
    try {
      localStorage.setItem(key(scopeId), JSON.stringify(remote.slice(-200)));
    } catch {
      /* */
    }
    return remote;
  }
  if (local.length && remote !== null && remote.length < local.length) {
    void syncBuilderChatToServer(scopeId, local);
  }
  return local;
}

export function draftScopeId(userId: string): string {
  return `draft:${userId || "anon"}`;
}

export function employeeScopeId(agentId: string): string {
  return `employee:${agentId}`;
}
