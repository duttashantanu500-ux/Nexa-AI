import { NextRequest, NextResponse } from "next/server";
import { assertCanAddConnection } from "@/lib/composio/accounts";
import {
  composioConfigured,
  composioFetch,
  composioUserId,
} from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deepPickRedirect(obj: any, depth = 0): string | null {
  if (!obj || depth > 5) return null;
  if (typeof obj === "string") {
    if (/^https?:\/\//i.test(obj)) return obj;
    return null;
  }
  if (typeof obj !== "object") return null;

  const directKeys = [
    "redirectUrl",
    "redirect_url",
    "authorizeUrl",
    "authorize_url",
    "url",
    "link",
    "redirectUri",
    "redirect_uri",
  ];
  for (const k of directKeys) {
    const v = obj[k];
    if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
  }

  for (const v of Object.values(obj)) {
    const found = deepPickRedirect(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function extractAuthConfigId(data: any): string | null {
  if (!data || typeof data !== "object") return null;
  const candidates = [
    data.id,
    data.nanoid,
    data.auth_config_id,
    data.authConfigId,
    data.auth_config?.id,
    data.auth_config?.nanoid,
    data.authConfig?.id,
    data.data?.id,
    data.data?.auth_config?.id,
  ];
  for (const c of candidates) {
    if (c) return String(c);
  }
  return null;
}

function extractItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const k of ["items", "data", "auth_configs", "results", "records"]) {
    if (Array.isArray(data[k])) return data[k];
  }
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  return [];
}

async function listAuthConfigsForToolkit(toolkit: string): Promise<any[]> {
  const queries = [
    `/auth_configs?toolkit_slug=${encodeURIComponent(toolkit)}&limit=20`,
    `/auth_configs?toolkit=${encodeURIComponent(toolkit)}&limit=20`,
    `/auth_configs?limit=50`,
  ];

  for (const path of queries) {
    const res = await composioFetch(path);
    if (!res.ok) continue;
    const items = extractItems(res.data);
    if (!items.length) continue;

    const matched = items.filter((a: any) => {
      const slug = String(
        a.toolkit?.slug || a.toolkit_slug || a.appName || a.app || ""
      ).toLowerCase();
      return !slug || slug === toolkit;
    });
    if (matched.length) return matched;
    if (path.includes("toolkit")) return items;
  }
  return [];
}

async function createManagedAuthConfig(
  toolkit: string
): Promise<{ id: string | null; status?: number; error?: string }> {
  const bodies = [
    {
      toolkit: { slug: toolkit },
      auth_config: {
        type: "use_composio_managed_auth",
        name: `${toolkit}-nexa`,
      },
    },
    {
      toolkit: { slug: toolkit },
      auth_config: { type: "use_composio_managed_auth" },
    },
    { toolkit: { slug: toolkit } },
  ];

  let lastStatus = 0;
  let lastMsg = "";

  for (const body of bodies) {
    const created = await composioFetch(`/auth_configs`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    lastStatus = created.status;
    lastMsg = String(
      created.data?.error?.message ||
        created.data?.message ||
        created.data?.error ||
        ""
    );
    const id = extractAuthConfigId(created.data);
    if (created.ok && id) return { id, status: created.status };

    if (/exist|already|duplicate/i.test(lastMsg)) {
      const listed = await listAuthConfigsForToolkit(toolkit);
      const existing = extractAuthConfigId(listed[0]);
      if (existing) return { id: existing };
    }
  }

  const listed = await listAuthConfigsForToolkit(toolkit);
  const existing = extractAuthConfigId(listed[0]);
  if (existing) return { id: existing };

  return {
    id: null,
    status: lastStatus,
    error: lastMsg || "Could not prepare sign-in for this app.",
  };
}

async function resolveAuthConfigId(
  toolkit: string
): Promise<{ id: string | null; status?: number; error?: string }> {
  const listed = await listAuthConfigsForToolkit(toolkit);
  if (listed.length) {
    const preferred =
      listed.find(
        (a: any) =>
          a.is_composio_managed === true ||
          a.isComposioManaged === true ||
          /composio|managed|default|nexa/i.test(
            String(a.name || a.type || a.auth_scheme || "")
          )
      ) || listed[0];
    const id = extractAuthConfigId(preferred);
    if (id) return { id };
  }
  return createManagedAuthConfig(toolkit);
}

async function createLinkSession(
  authConfigId: string,
  userId: string,
  callbackUrl: string
): Promise<{ redirectUrl: string | null; id: string | null; error?: string }> {
  const bodies = [
    {
      auth_config_id: authConfigId,
      user_id: userId,
      callback_url: callbackUrl,
    },
    {
      auth_config_id: authConfigId,
      user_id: userId,
    },
  ];

  for (const body of bodies) {
    const link = await composioFetch(`/connected_accounts/link`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const url = deepPickRedirect(link.data);
    if (link.ok && url) {
      return {
        redirectUrl: url,
        id:
          link.data?.connected_account_id ||
          link.data?.connectedAccountId ||
          link.data?.id ||
          null,
      };
    }
  }

  const initiatedBodies = [
    {
      auth_config: { id: authConfigId },
      connection: { user_id: userId, callback_url: callbackUrl },
    },
    {
      auth_config_id: authConfigId,
      user_id: userId,
      callback_url: callbackUrl,
    },
  ];

  for (const body of initiatedBodies) {
    const initiated = await composioFetch(`/connected_accounts`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const url = deepPickRedirect(initiated.data);
    if (initiated.ok && url) {
      return {
        redirectUrl: url,
        id: initiated.data?.id ? String(initiated.data.id) : null,
      };
    }
  }

  return {
    redirectUrl: null,
    id: null,
    error: "Couldn’t open the sign-in page for that app.",
  };
}

/** Session-based authorize (does not require pre-created auth configs). */
async function authorizeViaSession(
  userId: string,
  toolkit: string,
  callbackUrl: string
): Promise<{ redirectUrl: string | null; id: string | null }> {
  const sessionBodies = [
    { user_id: userId },
    { userId },
    { user_id: userId, toolkits: [toolkit] },
    { user_id: userId, manage_connections: false },
  ];

  const sessionPaths = [
    `/tool_router/session`,
    `/sessions`,
    `/tool_router/sessions`,
  ];

  let sessionId: string | null = null;
  let sessionData: any = null;

  for (const path of sessionPaths) {
    for (const body of sessionBodies) {
      const created = await composioFetch(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!created.ok) continue;
      sessionData = created.data;
      sessionId =
        created.data?.session_id ||
        created.data?.id ||
        created.data?.sessionId ||
        created.data?.data?.id ||
        null;
      // Sometimes create response already includes authorize URL for toolkit
      const early = deepPickRedirect(created.data);
      if (early) return { redirectUrl: early, id: sessionId };
      if (sessionId) break;
    }
    if (sessionId) break;
  }

  // Authorize toolkit on session
  const authorizePaths = sessionId
    ? [
        `/tool_router/session/${encodeURIComponent(sessionId)}/authorize`,
        `/sessions/${encodeURIComponent(sessionId)}/authorize`,
        `/tool_router/sessions/${encodeURIComponent(sessionId)}/authorize`,
      ]
    : [];

  const authorizeBodies = [
    { toolkit },
    { toolkit_slug: toolkit },
    { toolkit, callback_url: callbackUrl },
    { toolkit_slug: toolkit, callback_url: callbackUrl },
    { slug: toolkit, callback_url: callbackUrl },
  ];

  for (const path of authorizePaths) {
    for (const body of authorizeBodies) {
      const auth = await composioFetch(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const url = deepPickRedirect(auth.data);
      if (auth.ok && url) {
        return {
          redirectUrl: url,
          id:
            auth.data?.id ||
            auth.data?.connected_account_id ||
            sessionId ||
            null,
        };
      }
    }
  }

  // Single-shot authorize endpoints (no session id)
  const oneShot = [
    {
      path: `/toolkits/authorize`,
      body: { user_id: userId, toolkit, callback_url: callbackUrl },
    },
    {
      path: `/toolkits/${encodeURIComponent(toolkit)}/authorize`,
      body: { user_id: userId, callback_url: callbackUrl },
    },
    {
      path: `/connected_accounts/link`,
      body: {
        user_id: userId,
        toolkit,
        toolkit_slug: toolkit,
        callback_url: callbackUrl,
      },
    },
  ];

  for (const attempt of oneShot) {
    const res = await composioFetch(attempt.path, {
      method: "POST",
      body: JSON.stringify(attempt.body),
    });
    const url = deepPickRedirect(res.data);
    if (res.ok && url) {
      return {
        redirectUrl: url,
        id: res.data?.id || res.data?.connected_account_id || null,
      };
    }
  }

  return { redirectUrl: null, id: null };
}

/** POST — start app connection. Enforces max 3 accounts. */
export async function POST(req: NextRequest) {
  if (!composioConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "App connections aren’t available right now. Please try again later.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = composioUserId(String(body.userId || ""));
    const toolkit = String(body.toolkit || body.slug || "")
      .trim()
      .toLowerCase();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sign in required." },
        { status: 401 }
      );
    }
    if (!toolkit) {
      return NextResponse.json(
        { ok: false, error: "Choose an app to connect." },
        { status: 400 }
      );
    }

    const gate = await assertCanAddConnection(userId).catch(() => ({
      ok: true as const,
      used: 0,
    }));
    if (!gate.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You’ve used all 3 connection slots. Disconnect an app to free one.",
          used: gate.used,
          limit: 3,
        },
        { status: 403 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      req.nextUrl.origin;
    const callbackUrl = `${origin}/connections?connected=${encodeURIComponent(
      toolkit
    )}`;

    // 1) Preferred: existing/created auth config + link session
    const auth = await resolveAuthConfigId(toolkit);
    if (auth.id) {
      const result = await createLinkSession(auth.id, userId, callbackUrl);
      if (result.redirectUrl) {
        return NextResponse.json({
          ok: true,
          redirectUrl: result.redirectUrl,
          connectionRequestId: result.id,
          used: gate.used,
          remaining: Math.max(0, 3 - gate.used),
        });
      }
    }

    // 2) Fallback: session / toolkit authorize (no pre-made auth config)
    const sessionAuth = await authorizeViaSession(userId, toolkit, callbackUrl);
    if (sessionAuth.redirectUrl) {
      return NextResponse.json({
        ok: true,
        redirectUrl: sessionAuth.redirectUrl,
        connectionRequestId: sessionAuth.id,
        used: gate.used,
        remaining: Math.max(0, 3 - gate.used),
      });
    }

    const permissionHint =
      auth.status === 401 || auth.status === 403
        ? " Your project key can’t create app sign-in setups. In the connections dashboard, create a full Project API key (not a limited/scoped one), or add Auth Configs for the apps you need, then try again."
        : "";

    return NextResponse.json(
      {
        ok: false,
        error:
          `Couldn’t open the sign-in page for that app.${permissionHint}`.trim(),
        step: auth.id ? "link" : "auth_config",
      },
      { status: 502 }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not start connection. Please try again.",
      },
      { status: 500 }
    );
  }
}
