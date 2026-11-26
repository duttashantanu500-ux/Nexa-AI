import { NextRequest, NextResponse } from "next/server";
import { composioConfigured, composioFetch } from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?toolkit=gmail — diagnose auth_config + link without exposing secrets */
export async function GET(req: NextRequest) {
  if (!composioConfigured()) {
    return NextResponse.json({ ok: false, error: "not configured" });
  }

  const toolkit = (
    req.nextUrl.searchParams.get("toolkit") || "gmail"
  ).toLowerCase();

  const steps: any[] = [];

  const list1 = await composioFetch(
    `/auth_configs?toolkit_slug=${encodeURIComponent(toolkit)}&limit=10`
  );
  steps.push({
    step: "list_auth_configs_toolkit_slug",
    ok: list1.ok,
    status: list1.status,
    keys: list1.data && typeof list1.data === "object" ? Object.keys(list1.data) : [],
    message:
      list1.data?.error?.message ||
      list1.data?.message ||
      list1.data?.error ||
      null,
    itemCount: Array.isArray(list1.data?.items)
      ? list1.data.items.length
      : Array.isArray(list1.data?.data)
        ? list1.data.data.length
        : 0,
    sampleId:
      list1.data?.items?.[0]?.id ||
      list1.data?.items?.[0]?.nanoid ||
      list1.data?.data?.[0]?.id ||
      null,
  });

  const list2 = await composioFetch(`/auth_configs?limit=20`);
  steps.push({
    step: "list_auth_configs_all",
    ok: list2.ok,
    status: list2.status,
    message:
      list2.data?.error?.message ||
      list2.data?.message ||
      list2.data?.error ||
      null,
    itemCount: Array.isArray(list2.data?.items)
      ? list2.data.items.length
      : Array.isArray(list2.data?.data)
        ? list2.data.data.length
        : 0,
  });

  const createBodies = [
    {
      name: "managed_named",
      body: {
        toolkit: { slug: toolkit },
        auth_config: {
          type: "use_composio_managed_auth",
          name: `${toolkit}-nexa-debug`,
        },
      },
    },
    {
      name: "managed_default",
      body: {
        toolkit: { slug: toolkit },
        auth_config: { type: "use_composio_managed_auth" },
      },
    },
    {
      name: "toolkit_only",
      body: { toolkit: { slug: toolkit } },
    },
  ];

  let createdId: string | null = null;
  for (const c of createBodies) {
    const created = await composioFetch(`/auth_configs`, {
      method: "POST",
      body: JSON.stringify(c.body),
    });
    const id =
      created.data?.id ||
      created.data?.nanoid ||
      created.data?.auth_config?.id ||
      created.data?.auth_config?.nanoid ||
      null;
    steps.push({
      step: `create_${c.name}`,
      ok: created.ok,
      status: created.status,
      id,
      message:
        created.data?.error?.message ||
        created.data?.message ||
        created.data?.error ||
        null,
      responseKeys:
        created.data && typeof created.data === "object"
          ? Object.keys(created.data)
          : [],
    });
    if (created.ok && id) {
      createdId = String(id);
      break;
    }
  }

  const authConfigId =
    createdId ||
    list1.data?.items?.[0]?.id ||
    list1.data?.items?.[0]?.nanoid ||
    list2.data?.items?.[0]?.id ||
    null;

  if (authConfigId) {
    const link = await composioFetch(`/connected_accounts/link`, {
      method: "POST",
      body: JSON.stringify({
        auth_config_id: String(authConfigId),
        user_id: "debug-user",
        callback_url: "https://www.nexaiintelligence.online/connections",
      }),
    });
    steps.push({
      step: "link",
      ok: link.ok,
      status: link.status,
      hasRedirect: Boolean(
        link.data?.redirect_url || link.data?.redirectUrl || link.data?.url
      ),
      redirectPreview: String(
        link.data?.redirect_url || link.data?.redirectUrl || ""
      ).slice(0, 80),
      message:
        link.data?.error?.message ||
        link.data?.message ||
        link.data?.error ||
        null,
      responseKeys:
        link.data && typeof link.data === "object"
          ? Object.keys(link.data)
          : [],
    });
  } else {
    steps.push({ step: "link", skipped: true, reason: "no auth_config_id" });
  }

  return NextResponse.json({ ok: true, toolkit, steps });
}
