/**
 * Per-user Notion auth only.
 * Agents must use the signed-in user's connection — never a site-wide admin token.
 */

import { getConnection, type StoredConnection } from "./tokenStore";

export async function resolveNotionToken(
  userId: string
): Promise<{ token: string; source: "oauth"; meta: StoredConnection } | null> {
  if (!userId?.trim()) return null;

  const conn = await getConnection(userId, "notion");
  if (conn?.accessToken) {
    return { token: conn.accessToken, source: "oauth", meta: conn };
  }

  // Intentionally do NOT fall back to NOTION_INTERNAL_TOKEN.
  // That would run every user's agents against the admin workspace.
  return null;
}

/** Admin has configured Notion OAuth app (so users can Connect). */
export function notionOAuthConfigured(): boolean {
  return Boolean(
    process.env.NOTION_CLIENT_ID?.trim() && process.env.NOTION_CLIENT_SECRET?.trim()
  );
}
