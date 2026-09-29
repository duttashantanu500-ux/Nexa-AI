/**
 * Per-user custom MCP server connection.
 * Endpoint + optional auth stored encrypted via tokenStore.
 * Approved tool names are stored with the connection.
 */

import {
  deleteConnection,
  loadConnection,
  saveConnection,
  type StoredConnection,
} from "./tokenStore";
import { discoverMcpTools, callMcpTool, type McpTool } from "@/lib/mcp/client";

export type McpConnectorId = "mcp";

export interface McpConnectionMeta {
  endpoint: string;
  authHeader?: string;
  label?: string;
  approvedTools: string[];
  discoveredTools: McpTool[];
  serverName?: string;
}

function parseMeta(conn: StoredConnection): McpConnectionMeta | null {
  try {
    // accessToken holds JSON payload for MCP
    const data = JSON.parse(conn.accessToken) as McpConnectionMeta;
    if (!data?.endpoint) return null;
    return {
      endpoint: data.endpoint,
      authHeader: data.authHeader,
      label: data.label || conn.workspaceName || "Custom MCP",
      approvedTools: Array.isArray(data.approvedTools) ? data.approvedTools : [],
      discoveredTools: Array.isArray(data.discoveredTools) ? data.discoveredTools : [],
      serverName: data.serverName,
    };
  } catch {
    return null;
  }
}

export async function getMcpConnection(userId: string): Promise<McpConnectionMeta | null> {
  if (!userId) return null;
  const conn = await loadConnection(userId, "mcp" as "notion");
  if (!conn) return null;
  return parseMeta(conn);
}

export async function saveMcpConnection(
  userId: string,
  meta: McpConnectionMeta
): Promise<void> {
  const payload: McpConnectionMeta = {
    endpoint: meta.endpoint.trim(),
    authHeader: meta.authHeader?.trim() || undefined,
    label: meta.label?.trim() || "Custom MCP",
    approvedTools: meta.approvedTools || [],
    discoveredTools: meta.discoveredTools || [],
    serverName: meta.serverName,
  };
  await saveConnection({
    userId,
    connectorId: "mcp" as "notion",
    accessToken: JSON.stringify(payload),
    workspaceName: payload.label,
    scopes: payload.approvedTools,
    connectedAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
  });
}

export async function deleteMcpConnection(userId: string): Promise<void> {
  await deleteConnection(userId, "mcp" as "notion");
}

export async function connectAndDiscover(params: {
  userId: string;
  endpoint: string;
  authorization?: string;
  label?: string;
}): Promise<
  | { ok: true; tools: McpTool[]; serverName?: string }
  | { ok: false; message: string }
> {
  const endpoint = params.endpoint.trim();
  if (!endpoint) return { ok: false, message: "Enter your MCP server address." };

  const auth =
    params.authorization && params.authorization.trim()
      ? params.authorization.trim().startsWith("Bearer ")
        ? params.authorization.trim()
        : `Bearer ${params.authorization.trim()}`
      : undefined;

  const result = await discoverMcpTools(endpoint, auth);
  if (!result.ok) {
    return {
      ok: false,
      message: result.error || "Could not reach this MCP server.",
    };
  }

  const tools = result.tools || [];
  await saveMcpConnection(params.userId, {
    endpoint,
    authHeader: auth,
    label: params.label || result.serverInfo?.name || "Custom MCP",
    approvedTools: [],
    discoveredTools: tools,
    serverName: result.serverInfo?.name,
  });

  return {
    ok: true,
    tools,
    serverName: result.serverInfo?.name,
  };
}

export async function approveMcpTools(
  userId: string,
  toolNames: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const existing = await getMcpConnection(userId);
  if (!existing) return { ok: false, message: "Connect an MCP server first." };

  const allowed = new Set((existing.discoveredTools || []).map((t) => t.name));
  const approved = toolNames.filter((n) => allowed.has(n));

  await saveMcpConnection(userId, {
    ...existing,
    approvedTools: approved,
  });
  return { ok: true };
}

export async function testMcpConnection(
  userId: string
): Promise<{ ok: boolean; message: string; tools?: McpTool[] }> {
  const existing = await getMcpConnection(userId);
  if (!existing) {
    return { ok: false, message: "No MCP server connected yet." };
  }
  const result = await discoverMcpTools(existing.endpoint, existing.authHeader);
  if (!result.ok) {
    return { ok: false, message: result.error || "MCP server is not responding." };
  }
  const tools = result.tools || [];
  await saveMcpConnection(userId, {
    ...existing,
    discoveredTools: tools,
    // Keep only approvals that still exist
    approvedTools: existing.approvedTools.filter((n) =>
      tools.some((t) => t.name === n)
    ),
    serverName: result.serverInfo?.name || existing.serverName,
  });
  return {
    ok: true,
    message: `Connected · ${tools.length} tool${tools.length === 1 ? "" : "s"} found`,
    tools,
  };
}

export async function executeApprovedMcpTool(params: {
  userId: string;
  toolName: string;
  args?: Record<string, unknown>;
}): Promise<{ ok: boolean; message: string; data?: unknown }> {
  const existing = await getMcpConnection(params.userId);
  if (!existing) {
    return { ok: false, message: "Connect an MCP server under Connections first." };
  }
  if (!existing.approvedTools.includes(params.toolName)) {
    return {
      ok: false,
      message: "This tool is not approved for your agents yet.",
    };
  }
  const res = await callMcpTool(
    existing.endpoint,
    params.toolName,
    params.args || {},
    existing.authHeader
  );
  if (!res.ok) {
    return { ok: false, message: res.error || "MCP tool failed." };
  }
  const text =
    typeof res.result === "string"
      ? res.result
      : JSON.stringify(res.result, null, 2).slice(0, 4000);
  return { ok: true, message: text || "Done", data: res.result };
}
