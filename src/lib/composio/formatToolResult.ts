/**
 * Format Composio tool results for chat — concise, no secrets, no walls of JSON.
 */

function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

function pickList(data: Record<string, unknown>): { key: string; items: unknown[] } | null {
  const keys = [
    "messages",
    "emails",
    "channels",
    "items",
    "files",
    "events",
    "repos",
    "repositories",
    "issues",
    "tasks",
    "boards",
    "contacts",
    "pages",
    "results",
    "data",
  ];
  for (const k of keys) {
    const arr = asArray(data[k]);
    if (arr) return { key: k, items: arr };
  }
  return null;
}

function labelItem(item: unknown, index: number): string {
  if (item == null) return `${index + 1}. (empty)`;
  if (typeof item === "string") return `${index + 1}. ${item.slice(0, 120)}`;
  if (typeof item !== "object") return `${index + 1}. ${String(item).slice(0, 120)}`;
  const o = item as Record<string, unknown>;
  const name =
    o.name ||
    o.title ||
    o.subject ||
    o.fullName ||
    o.email ||
    o.snippet ||
    o.text ||
    o.id;
  const extra = o.email && o.name ? String(o.email) : o.from || o.channel || o.status;
  const main = name != null ? String(name).slice(0, 100) : `Item ${index + 1}`;
  return extra ? `${index + 1}. ${main} — ${String(extra).slice(0, 60)}` : `${index + 1}. ${main}`;
}

export function formatToolResult(result: unknown): string {
  try {
    if (result == null) return "Done.";
    if (typeof result === "string") return result.slice(0, 1600);

    const root = result as Record<string, unknown>;
    const data = (root.data ?? root.result ?? root.response_data ?? root) as Record<
      string,
      unknown
    >;

    if (Array.isArray(data)) {
      const lines = data.slice(0, 8).map((it, i) => labelItem(it, i));
      const more = data.length > 8 ? `\n…and ${data.length - 8} more.` : "";
      return `Found ${data.length}:\n${lines.join("\n")}${more}`;
    }

    if (data && typeof data === "object") {
      const list = pickList(data);
      if (list) {
        const lines = list.items.slice(0, 8).map((it, i) => labelItem(it, i));
        const more =
          list.items.length > 8 ? `\n…and ${list.items.length - 8} more.` : "";
        return `Found ${list.items.length} ${list.key}:\n${lines.join("\n")}${more}`;
      }
      const keys = Object.keys(data);
      if (keys.length === 0) return "Done.";
      // Short key summary without dumping secrets
      const safe = keys
        .filter((k) => !/token|secret|password|key|auth/i.test(k))
        .slice(0, 6);
      return safe.length
        ? `Got a response (${safe.join(", ")}).`
        : "Got a response from the app.";
    }

    return "Done.";
  } catch {
    return "Done.";
  }
}
