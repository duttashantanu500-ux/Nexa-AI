/**
 * Browser-safe Notion action runner.
 * Calls the server; never handles access tokens on the client.
 */

export async function runNotionAction(params: {
  userId: string;
  actionId: string;
  input: Record<string, string>;
}): Promise<{
  ok: boolean;
  message: string;
  data?: unknown;
  error?: { category?: string; providerStatusCode?: number; providerMessage?: string };
}> {
  const res = await fetch("/api/connections/notion/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: params.userId,
      actionId: params.actionId,
      input: params.input,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: Boolean(data.ok),
    message: data.message || (data.ok ? "OK" : "Failed"),
    data: data.data,
    error: data.error,
  };
}
