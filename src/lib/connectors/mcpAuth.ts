/**
 * Custom MCP connection storage + execute helpers.
 */

import {
  loadConnection,
  saveConnection,
  deleteConnection,
  type StoredConnection,
} from "./tokenStore";

export type McpToolInfo = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export async function resolveMcpConnection(
  userId: string
): Promise<{ endpoint: string; authHeader?: string; meta: StoredConnection } | null> {
  const conn = await loadConnection(userId, "mcp");
  if (!conn?.accessToken) return null;
  // accessToken stores the endpoint URL; refreshToken optional auth header value
  return {
    endpoint: conn.accessToken,
    authHeader: conn.refreshToken,
    meta: conn,
  };
}

export async function saveMcpConnection(params: {
  userId: string;
  endpoint: string;
  authHeader?: string;
  workspaceName?: string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    await saveConnection({
      userId: params.userId,
      connectorId: "mcp",
      accessToken: params.endpoint,
      refreshToken: params.authHeader,
      workspaceName: params.workspaceName || "MCP",
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not save your MCP connection." };
  }
}

export async function removeMcpConnection(userId: string): Promise<void> {
  await deleteConnection(userId, "mcp");
}

/** Tools the user has approved for agent use (stored in scopes JSON). */
export function parseApprovedTools(conn: StoredConnection | null): string[] {
  const scopes = conn?.scopes || [];
  return scopes.filter(Boolean);
}

export async function setApprovedTools(
  userId: string,
  tools: string[]
): Promise<{ ok: boolean; message?: string }> {
  const conn = await loadConnection(userId, "mcp");
  if (!conn) return { ok: false, message: "Connect an MCP server first." };
  try {
    await saveConnection({
      ...conn,
      scopes: tools,
      lastVerifiedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not save tool approvals." };
  }
}

export async function executeApprovedMcpTool(params: {
  userId: string;
  toolName: string;
  args?: Record<string, unknown>;
}): Promise<{ ok: boolean; message: string; data?: unknown }> {
  const resolved = await resolveMcpConnection(params.userId);
  if (!resolved) {
    return { ok: false, message: "Connect an MCP server first." };
  }
  const approved = parseApprovedTools(resolved.meta);
  if (!approved.includes(params.toolName)) {
    return {
      ok: false,
      message: "This tool is not approved for your AI employees yet.",
    };
  }
  // Actual MCP JSON-RPC is handled in API routes; this is a server-side fallback.
  return {
    ok: false,
    message: "Run this tool from the browser while signed in.",
  };
}
