/**
 * Custom tools connection storage + execute helpers.
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
      workspaceName: params.workspaceName || "Custom tools",
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not save your custom tools connection." };
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
  if (!conn) return { ok: false, message: "Connect custom tools first." };
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

/** Alias used by the approve API route. */
export async function approveMcpTools(
  userId: string,
  tools: string[]
): Promise<{ ok: boolean; message?: string }> {
  return setApprovedTools(userId, tools);
}

export async function executeApprovedMcpTool(params: {
  userId: string;
  toolName: string;
  args?: Record<string, unknown>;
}): Promise<{ ok: boolean; message: string; data?: unknown }> {
  const resolved = await resolveMcpConnection(params.userId);
  if (!resolved) {
    return { ok: false, message: "Connect custom tools first." };
  }
  const approved = parseApprovedTools(resolved.meta);
  if (!approved.includes(params.toolName)) {
    return {
      ok: false,
      message: "This tool is not approved for your AI employees yet.",
    };
  }
  return {
    ok: false,
    message: "Run this tool from the browser while signed in.",
  };
}
