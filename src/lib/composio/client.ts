/**
 * Server-oriented Composio helpers using REST only.
 * Do not import @composio/core here — it pulls node: builtins into client bundles
 * when this module is reached from shared lib code.
 */

const BASES = [
  "https://backend.composio.dev/api/v3.1",
  "https://backend.composio.dev/api/v3",
] as const;

export function composioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY?.trim());
}

export function composioApiKey(): string {
  return process.env.COMPOSIO_API_KEY?.trim() || "";
}

/** Map Nexa user id → Composio userId (1:1 isolation). */
export function composioUserId(nexaUserId: string): string {
  return String(nexaUserId || "").trim();
}

export async function composioFetch(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: any }> {
  const key = composioApiKey();
  if (!key) return { ok: false, status: 0, data: {} };

  for (const base of BASES) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          "x-api-key": key,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, status: res.status, data };
      if (res.status !== 404) return { ok: false, status: res.status, data };
    } catch {
      /* try next base */
    }
  }
  return { ok: false, status: 0, data: {} };
}

/** Execute a tool via Composio REST. */
export async function executeComposioTool(params: {
  toolSlug: string;
  userId: string;
  arguments?: Record<string, unknown>;
  connectedAccountId?: string;
}): Promise<{ ok: boolean; data?: any; error?: string }> {
  const body: Record<string, unknown> = {
    user_id: params.userId,
    arguments: params.arguments || {},
  };
  if (params.connectedAccountId) {
    body.connected_account_id = params.connectedAccountId;
  }

  // Prefer slug path variants used across v3 / v3.1
  const attempts = [
    `/tools/execute/${encodeURIComponent(params.toolSlug)}`,
    `/tools/${encodeURIComponent(params.toolSlug)}/execute`,
  ];

  for (const path of attempts) {
    const res = await composioFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      if (res.data?.error || res.data?.successful === false) {
        return {
          ok: false,
          data: res.data,
          error: String(res.data.error || res.data.message || "Tool failed"),
        };
      }
      return { ok: true, data: res.data };
    }
  }

  // Generic execute with tool_slug in body
  const generic = await composioFetch(`/tools/execute`, {
    method: "POST",
    body: JSON.stringify({
      tool_slug: params.toolSlug,
      ...body,
    }),
  });
  if (generic.ok) {
    if (generic.data?.error || generic.data?.successful === false) {
      return {
        ok: false,
        data: generic.data,
        error: String(
          generic.data.error || generic.data.message || "Tool failed"
        ),
      };
    }
    return { ok: true, data: generic.data };
  }

  return {
    ok: false,
    error:
      generic.data?.error?.message ||
      generic.data?.message ||
      "Could not run this app action.",
  };
}
