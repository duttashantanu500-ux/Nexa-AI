/**
 * Browser helper: ask the server to execute a Composio tool for the signed-in user.
 * Never passes secrets; server validates ownership.
 */

export type ComposioExecuteResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

export async function executeComposioTool(params: {
  userId: string;
  toolSlug: string;
  arguments?: Record<string, unknown>;
  connectedAccountId?: string;
}): Promise<ComposioExecuteResult> {
  try {
    const res = await fetch("/api/composio/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: params.userId,
        toolSlug: params.toolSlug,
        arguments: params.arguments || {},
        connectedAccountId: params.connectedAccountId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      return { ok: false, error: data.error || "Tool execution failed" };
    }
    return { ok: true, result: data.result };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Tool execution failed" };
  }
}

export async function listComposioConnections(userId: string): Promise<{
  used: number;
  limit: number;
  accounts: { id: string; toolkit: string; status: string }[];
}> {
  try {
    const res = await fetch(
      `/api/composio/connections?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    return {
      used: Number(data.used) || 0,
      limit: Number(data.limit) || 3,
      accounts: Array.isArray(data.accounts) ? data.accounts : [],
    };
  } catch {
    return { used: 0, limit: 3, accounts: [] };
  }
}
