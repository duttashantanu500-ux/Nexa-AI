/**
 * Notion parent page helpers.
 * When a user picks a Notion page (or has a saved default), inject it into
 * create/append steps so work can finish without a separate setup screen.
 */

export const NOTION_PARENT_KEY = "nexa_notion_default_parent";

export function getNotionParent(): string {
  try {
    return (localStorage.getItem(NOTION_PARENT_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setNotionParent(idOrUrl: string): void {
  const v = String(idOrUrl || "").trim();
  if (!v) return;
  try {
    localStorage.setItem(NOTION_PARENT_KEY, v);
  } catch {
    /* private mode */
  }
}

function isNotionWriteAction(actionId: string | undefined): boolean {
  const a = String(actionId || "").toLowerCase();
  return (
    a === "notion.create_page" ||
    a === "notion.append_blocks" ||
    a.startsWith("notion.create") ||
    a.startsWith("notion.append")
  );
}

/** True when step already has a parent target. */
export function stepHasNotionParent(config: Record<string, unknown> | undefined): boolean {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  return Boolean(
    String(c.parent_id || "").trim() ||
      String(c.parent_url || "").trim() ||
      String(c.parent_name || "").trim() ||
      String(c.parent || "").trim()
  );
}

/**
 * Fill missing parent_id on Notion write steps from a known parent id/url
 * and optional label (parent_name).
 */
export function injectNotionParentIntoSteps<
  T extends { actionId?: string; config?: Record<string, unknown> }
>(steps: T[], parentId: string, parentLabel?: string): T[] {
  const pid = String(parentId || "").trim();
  if (!pid || !Array.isArray(steps)) return steps;
  return steps.map((st) => {
    if (!isNotionWriteAction(st.actionId)) return st;
    if (stepHasNotionParent(st.config)) return st;
    return {
      ...st,
      config: {
        ...(st.config && typeof st.config === "object" ? st.config : {}),
        parent_id: pid,
        ...(parentLabel ? { parent_name: parentLabel } : {}),
      },
    };
  });
}

/**
 * Prefer saved default; otherwise first page from live options list.
 */
export async function resolveNotionParentForHire(userId?: string): Promise<{
  parentId: string;
  parentLabel?: string;
}> {
  const saved = getNotionParent();
  if (saved) return { parentId: saved };

  if (!userId) return { parentId: "" };
  try {
    const res = await fetch(
      `/api/connections/live-options?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    const pages = data?.options?.notionPages;
    if (Array.isArray(pages) && pages.length > 0 && pages[0]?.id) {
      const id = String(pages[0].id);
      const label = String(pages[0].label || "");
      setNotionParent(id);
      return { parentId: id, parentLabel: label || undefined };
    }
  } catch {
    /* soft-fail */
  }
  return { parentId: "" };
}
