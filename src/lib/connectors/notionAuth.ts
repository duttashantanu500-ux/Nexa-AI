/**
 * Resolve Notion access token for a Nexa user.
 * Priority: per-user OAuth store → workspace internal token (env).
 */

import { getConnection, type StoredConnection } from "./tokenStore";

export async function resolveNotionToken(
  userId: string
): Promise<{ token: string; source: "oauth" | "internal"; meta?: StoredConnection } | null> {
  if (userId) {
    const conn = await getConnection(userId, "notion");
    if (conn?.accessToken) {
      return { token: conn.accessToken, source: "oauth", meta: conn };
    }
  }

  const internal = process.env.NOTION_INTERNAL_TOKEN?.trim();
  if (internal) {
    return {
      token: internal,
      source: "internal",
      meta: {
        userId: userId || "workspace",
        connectorId: "notion",
        accessToken: internal,
        workspaceName: "Internal connection",
        connectedAt: new Date(0).toISOString(),
      },
    };
  }

  return null;
}

export function notionAdminConfigured(): boolean {
  return Boolean(
    process.env.NOTION_INTERNAL_TOKEN?.trim() ||
      (process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET)
  );
}
