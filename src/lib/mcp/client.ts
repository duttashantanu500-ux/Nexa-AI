/**
 * Minimal MCP client (Streamable HTTP / JSON-RPC style).
 * Discovers tools from a user-provided endpoint. No fake tools.
 */

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpDiscoverResult {
  ok: boolean;
  tools?: McpTool[];
  error?: string;
  serverInfo?: { name?: string; version?: string };
}

export interface McpCallResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

const TIMEOUT_MS = 15000;
const MAX_BODY = 512_000;

function assertHttps(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
      return "MCP endpoint must use HTTPS (or localhost for development)";
    }
    return null;
  } catch {
    return "Invalid MCP URL";
  }
}

async function rpc(
  endpoint: string,
  method: string,
  params?: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params: params || {},
      }),
      signal: ctrl.signal,
    });

    const text = await res.text();
    if (text.length > MAX_BODY) {
      return { ok: false, error: "MCP response too large" };
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: `MCP returned non-JSON (${res.status}). Endpoint may not speak MCP JSON-RPC.`,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message || `MCP HTTP ${res.status}`,
      };
    }
    if (data.error) {
      return {
        ok: false,
        error: data.error.message || JSON.stringify(data.error),
      };
    }
    return { ok: true, data: data.result ?? data };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { ok: false, error: "MCP request timed out after 15s" };
    }
    return { ok: false, error: err?.message || "MCP request failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverMcpTools(
  endpoint: string,
  authHeader?: string
): Promise<McpDiscoverResult> {
  const httpsErr = assertHttps(endpoint);
  if (httpsErr) return { ok: false, error: httpsErr };

  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;

  // initialize
  const init = await rpc(
    endpoint,
    "initialize",
    {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "nexa", version: "1.0.0" },
    },
    headers
  );

  if (!init.ok) {
    // Some servers only need tools/list
    const listOnly = await rpc(endpoint, "tools/list", {}, headers);
    if (!listOnly.ok) {
      return {
        ok: false,
        error: init.error || listOnly.error || "Connection failed",
      };
    }
    const tools = normalizeTools(listOnly.data);
    return { ok: true, tools };
  }

  const list = await rpc(endpoint, "tools/list", {}, headers);
  if (!list.ok) {
    return { ok: false, error: list.error || "tools/list failed" };
  }

  return {
    ok: true,
    tools: normalizeTools(list.data),
    serverInfo: init.data?.serverInfo,
  };
}

function normalizeTools(data: any): McpTool[] {
  const raw = data?.tools || data || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t: any) => t && typeof t.name === "string")
    .map((t: any) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: t.inputSchema || t.input_schema || undefined,
    }));
}

export async function callMcpTool(
  endpoint: string,
  toolName: string,
  args: Record<string, unknown>,
  authHeader?: string
): Promise<McpCallResult> {
  const httpsErr = assertHttps(endpoint);
  if (httpsErr) return { ok: false, error: httpsErr };

  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;

  const res = await rpc(
    endpoint,
    "tools/call",
    { name: toolName, arguments: args },
    headers
  );

  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, result: res.data };
}
