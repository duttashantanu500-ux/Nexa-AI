import { NextRequest, NextResponse } from "next/server";
import { assertCanAddConnection } from "@/lib/composio/accounts";
import {
  composioConfigured,
  composioUserId,
  getComposio,
} from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickRedirect(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  const url =
    obj.redirectUrl ||
    obj.redirect_url ||
    obj.url ||
    obj.link ||
    obj.authorizeUrl ||
    obj.authorize_url ||
    null;
  return url ? String(url) : null;
}

async function restJson(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: any }> {
  const key = process.env.COMPOSIO_API_KEY?.trim() || "";
  const bases = [
    "https://backend.composio.dev/api/v3.1",
    "https://backend.composio.dev/api/v3",
  ];
  for (const base of bases) {
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
      // Prefer first non-404 response body for debugging soft fails
      if (res.status !== 404) return { ok: false, status: res.status, data };
    } catch {
      /* try next base */
    }
  }
  return { ok: false, status: 0, data: {} };
}

async function resolveAuthConfigId(toolkit: string): Promise<string | null> {
  // List auth configs filtered by toolkit
  const listed = await restJson(
    `/auth_configs?toolkit_slug=${encodeURIComponent(toolkit)}&limit=10`
  );
  const items =
    listed.data?.items ||
    listed.data?.data ||
    listed.data?.auth_configs ||
    (Array.isArray(listed.data) ? listed.data : []);
  if (Array.isArray(items) && items.length) {
    const preferred =
      items.find((a: any) =>
        /composio|managed|default/i.test(String(a.name || a.type || ""))
      ) || items[0];
    const id = preferred?.id || preferred?.nanoid || preferred?.auth_config_id;
    if (id) return String(id);
  }

  // Create a managed auth config for this toolkit if none exist
  const created = await restJson(`/auth_configs`, {
    method: "POST",
    body: JSON.stringify({
      toolkit: { slug: toolkit },
      auth_config: {
        type: "use_composio_managed_auth",
        name: `${toolkit}-nexa`,
      },
    }),
  });
  const cid =
    created.data?.id ||
    created.data?.auth_config?.id ||
    created.data?.nanoid ||
    null;
  return cid ? String(cid) : null;
}

async function connectViaRest(
  userId: string,
  toolkit: string,
  callbackUrl: string
): Promise<{ redirectUrl: string | null; id: string | null }> {
  const authConfigId = await resolveAuthConfigId(toolkit);
  if (!authConfigId) {
    return { redirectUrl: null, id: null };
  }

  // Preferred: hosted connect link
  const link = await restJson(`/connected_accounts/link`, {
    method: "POST",
    body: JSON.stringify({
      auth_config_id: authConfigId,
      user_id: userId,
      callback_url: callbackUrl,
    }),
  });
  const linkUrl = pickRedirect(link.data);
  if (linkUrl) {
    return {
      redirectUrl: linkUrl,
      id: link.data?.connected_account_id
        ? String(link.data.connected_account_id)
        : null,
    };
  }

  // Legacy initiate path
  const initiated = await restJson(`/connected_accounts`, {
    method: "POST",
    body: JSON.stringify({
      auth_config: { id: authConfigId },
      connection: {
        user_id: userId,
        callback_url: callbackUrl,
      },
    }),
  });
  return {
    redirectUrl: pickRedirect(initiated.data) || pickRedirect(initiated.data?.connection),
    id: initiated.data?.id ? String(initiated.data.id) : null,
  };
}

async function connectViaSdk(
  userId: string,
  toolkit: string,
  callbackUrl: string
): Promise<{ redirectUrl: string | null; id: string | null }> {
  const composio = getComposio() as any;

  // Modern session API
  if (typeof composio.create === "function") {
    try {
      const session = await composio.create(userId);
      if (session && typeof session.authorize === "function") {
        const req = await session.authorize(toolkit, {
          callbackUrl,
          callback_url: callbackUrl,
        });
        const url = pickRedirect(req);
        if (url) {
          return {
            redirectUrl: url,
            id: req?.id || req?.connectedAccountId || null,
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // toolkits.authorize(userId, toolkit)
  if (composio.toolkits && typeof composio.toolkits.authorize === "function") {
    try {
      const req = await composio.toolkits.authorize(userId, toolkit);
      const url = pickRedirect(req);
      if (url) {
        return {
          redirectUrl: url,
          id: req?.id || null,
        };
      }
    } catch {
      /* fall through */
    }
  }

  // connectedAccounts.initiate
  if (
    composio.connectedAccounts &&
    typeof composio.connectedAccounts.initiate === "function"
  ) {
    try {
      const authConfigId = await resolveAuthConfigId(toolkit);
      if (authConfigId) {
        const req = await composio.connectedAccounts.initiate(
          userId,
          authConfigId,
          { callbackUrl, callback_url: callbackUrl }
        );
        const url = pickRedirect(req);
        if (url) {
          return { redirectUrl: url, id: req?.id || null };
        }
      }
    } catch {
      /* fall through */
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
    const callbackUrl = `${origin}/connections?connected=${encodeURIComponent(toolkit)}`;

    let result = await connectViaSdk(userId, toolkit, callbackUrl);
    if (!result.redirectUrl) {
      result = await connectViaRest(userId, toolkit, callbackUrl);
    }

    if (!result.redirectUrl) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Couldn’t open the sign-in page for that app. Try another app or try again in a moment.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      redirectUrl: result.redirectUrl,
      connectionRequestId: result.id,
      used: gate.used,
      remaining: 3 - gate.used,
    });
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
