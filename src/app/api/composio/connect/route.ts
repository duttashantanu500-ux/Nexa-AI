import { NextRequest, NextResponse } from "next/server";
import { assertCanAddConnection } from "@/lib/composio/accounts";
import {
  composioConfigured,
  composioFetch,
  composioUserId,
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

async function resolveAuthConfigId(toolkit: string): Promise<string | null> {
  const listed = await composioFetch(
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

  const created = await composioFetch(`/auth_configs`, {
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

  const link = await composioFetch(`/connected_accounts/link`, {
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

  const initiated = await composioFetch(`/connected_accounts`, {
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
    redirectUrl:
      pickRedirect(initiated.data) ||
      pickRedirect(initiated.data?.connection),
    id: initiated.data?.id ? String(initiated.data.id) : null,
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
    const callbackUrl = `${origin}/connections?connected=${encodeURIComponent(toolkit)}`;

    const result = await connectViaRest(userId, toolkit, callbackUrl);

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
