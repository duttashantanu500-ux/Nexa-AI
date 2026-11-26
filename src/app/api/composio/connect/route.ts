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
  if (!obj || depth > 4) return null;
  if (typeof obj === "string") {
    if (/^https?:\/\//i.test(obj) && /composio|oauth|authorize|connect/i.test(obj))
      return obj;
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

    // Prefer configs for this toolkit when listing unfiltered
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
): Promise<{ id: string | null; error?: string }> {
  // Docs default: { toolkit: { slug }, auth_config: { type: use_composio_managed_auth } }
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
    {
      toolkit: { slug: toolkit },
    },
  ];

  for (const body of bodies) {
    const created = await composioFetch(`/auth_configs`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const id = extractAuthConfigId(created.data);
    if (created.ok && id) return { id };

    // If already exists, list again
    const msg = String(
      created.data?.error?.message ||
        created.data?.message ||
        created.data?.error ||
        ""
    ).toLowerCase();
    if (/exist|already|duplicate/i.test(msg)) {
      const listed = await listAuthConfigsForToolkit(toolkit);
      const existing = extractAuthConfigId(listed[0]);
      if (existing) return { id: existing };
    }
  }

  // Final list attempt
  const listed = await listAuthConfigsForToolkit(toolkit);
  const existing = extractAuthConfigId(listed[0]);
  if (existing) return { id: existing };

  return {
    id: null,
    error: "Could not prepare sign-in for this app.",
  };
}

async function resolveAuthConfigId(
  toolkit: string
): Promise<{ id: string | null; error?: string }> {
  const listed = await listAuthConfigsForToolkit(toolkit);
  if (listed.length) {
    const preferred =
      listed.find((a: any) =>
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
    {
      authConfigId: authConfigId,
      userId: userId,
      callbackUrl: callbackUrl,
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

  // Fallback: initiate (custom / non-OAuth still supported)
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

    const auth = await resolveAuthConfigId(toolkit);
    if (!auth.id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            auth.error ||
            "This app isn’t ready to connect yet. Try another app or try again in a moment.",
          step: "auth_config",
        },
        { status: 502 }
      );
    }

    const result = await createLinkSession(auth.id, userId, callbackUrl);
    if (!result.redirectUrl) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error ||
            "Couldn’t open the sign-in page for that app. Try another app or try again in a moment.",
          step: "link",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      redirectUrl: result.redirectUrl,
      connectionRequestId: result.id,
      used: gate.used,
      remaining: Math.max(0, 3 - gate.used),
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
