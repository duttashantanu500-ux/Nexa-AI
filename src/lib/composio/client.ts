/**
 * Server-oriented Composio helpers using REST only.
 * Do not import @composio/core here — it pulls node: builtins into client bundles
 * when this module is reached from shared lib code.
 */

const BASES = [
  "https://backend.composio.dev/api/v3.1",
  "https://backend.composio.dev/api/v3",
] as const;

/** Strip quotes/whitespace people often paste into Vercel env. */
function normalizeKey(raw: string): string {
  let k = String(raw || "").trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(k)) k = k.replace(/^bearer\s+/i, "").trim();
  return k;
}

export function composioConfigured(): boolean {
  return Boolean(normalizeKey(process.env.COMPOSIO_API_KEY || ""));
}

export function composioApiKey(): string {
  return normalizeKey(process.env.COMPOSIO_API_KEY || "");
}

/** Map Nexa user id → Composio userId (1:1 isolation). */
export function composioUserId(nexaUserId: string): string {
  return String(nexaUserId || "").trim();
}

function authHeaderSets(key: string): Record<string, string>[] {
  const sets: Record<string, string>[] = [{ "x-api-key": key }];
  // Org keys must use x-org-api-key (common mix-up → 401)
  if (/^org[_-]?/i.test(key) || key.length > 40) {
    sets.push({ "x-org-api-key": key });
  }
  // User keys must use x-user-api-key — will still fail for toolkits, but clearer
  if (/^uak_/i.test(key)) {
    sets.unshift({ "x-user-api-key": key });
  }
  return sets;
}

export async function composioFetch(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: any }> {
  const key = composioApiKey();
  if (!key) return { ok: false, status: 0, data: {} };

  for (const base of BASES) {
    for (const auth of authHeaderSets(key)) {
      try {
        const res = await fetch(`${base}${path}`, {
          ...init,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...auth,
            ...(init?.headers || {}),
          },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) return { ok: true, status: res.status, data };
        // Auth failure: try next header style before next base
        if (res.status === 401 || res.status === 403) continue;
        if (res.status !== 404) return { ok: false, status: res.status, data };
      } catch {
        /* try next */
      }
    }
  }
  return { ok: false, status: 401, data: { message: "unauthorized" } };
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
