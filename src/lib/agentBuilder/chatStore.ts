/**
 * Persistent AI Employee Builder chat — one conversation per draft/employee.
 * Full history is kept for the UI; the API only receives a recent window + summary.
 */
const KEY_PREFIX = "nexa_employee_builder_chat_v1:";

export type BuilderLine = {
  role: "user" | "assistant";
  content: string;
  thinking?: string[];
};

function key(scopeId: string) {
  return KEY_PREFIX + scopeId;
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
      }));
  } catch {
    return [];
  }
}

export function saveBuilderChat(scopeId: string, lines: BuilderLine[]): void {
  if (typeof window === "undefined" || !scopeId) return;
  try {
    const trimmed = lines.slice(-200);
    localStorage.setItem(key(scopeId), JSON.stringify(trimmed));
  } catch {
    /* quota */
  }
}

export function migrateBuilderChat(fromScope: string, toScope: string): void {
  if (!fromScope || !toScope || fromScope === toScope) return;
  const lines = loadBuilderChat(fromScope);
  if (!lines.length) return;
  const existing = loadBuilderChat(toScope);
  saveBuilderChat(toScope, existing.length ? [...existing, ...lines] : lines);
  try {
    localStorage.removeItem(key(fromScope));
  } catch {
    /* */
  }
}

export function draftScopeId(userId: string): string {
  return `draft:${userId || "anon"}`;
}

export function employeeScopeId(agentId: string): string {
  return `employee:${agentId}`;
}
