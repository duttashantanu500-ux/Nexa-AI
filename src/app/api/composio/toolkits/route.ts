import { NextRequest, NextResponse } from "next/server";
import { composioConfigured, getComposio } from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ToolkitRow = {
  slug: string;
  name: string;
  logo: string;
  description: string;
  categories: string[];
};

function mapItem(t: any): ToolkitRow | null {
  const slug = String(
    t.slug || t.key || t.appKey || t.toolkit_slug || t.appName || t.name || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!slug) return null;
  const name = String(t.name || t.displayName || t.display_name || t.appName || slug);
  const logo = String(
    t.logo ||
      t.meta?.logo ||
      t.meta?.app_url_logo ||
      t.icon ||
      t.image ||
      `https://logos.composio.dev/api/${encodeURIComponent(slug)}`
  );
  const description = String(
    t.description || t.meta?.description || t.shortDescription || ""
  );
  const categories = Array.isArray(t.categories)
    ? t.categories.map((c: any) => String(c.name || c))
    : Array.isArray(t.meta?.categories)
      ? t.meta.categories.map((c: any) => String(c.name || c))
      : [];
  return { slug, name, logo, description, categories };
}

function extractItems(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  for (const k of ["items", "data", "toolkits", "apps", "results", "records"]) {
    if (Array.isArray(raw[k])) return raw[k];
  }
  if (raw.data && Array.isArray(raw.data.items)) return raw.data.items;
  return [];
}

async function fetchJson(url: string, key: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        "x-api-key": key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

async function fetchViaRest(limit: number): Promise<any[]> {
  const key = process.env.COMPOSIO_API_KEY?.trim();
  if (!key) return [];

  const urls = [
    `https://backend.composio.dev/api/v3/toolkits?limit=${limit}`,
    `https://backend.composio.dev/api/v2/apps?limit=${limit}`,
    `https://api.composio.dev/api/v1/apps?limit=${limit}`,
    `https://backend.composio.dev/api/v1/apps?limit=${limit}`,
  ];

  for (const url of urls) {
    const raw = await fetchJson(url, key);
    const items = extractItems(raw);
    if (items.length) return items;
  }
  return [];
}

async function fetchViaSdk(limit: number): Promise<any[]> {
  try {
    const composio = getComposio();
    const tk = composio.toolkits as any;
    const tools = (composio as any).tools;

    const attempts: Array<() => Promise<any>> = [
      () => tk?.get?.({ limit }),
      () => tk?.list?.({ limit }),
      () => tools?.getToolkits?.({ limit }),
      () => tools?.listToolkits?.({ limit }),
    ];

    for (const fn of attempts) {
      try {
        const raw = await fn();
        const items = extractItems(raw);
        if (items.length) return items;
      } catch {
        /* next */
      }
    }
  } catch {
    /* */
  }
  return [];
}

/** Popular apps shown when the remote catalogue is temporarily empty. */
const FALLBACK_APPS: ToolkitRow[] = [
  { slug: "gmail", name: "Gmail", logo: "https://logos.composio.dev/api/gmail", description: "Email", categories: ["Communication"] },
  { slug: "outlook", name: "Outlook", logo: "https://logos.composio.dev/api/outlook", description: "Email & calendar", categories: ["Communication"] },
  { slug: "github", name: "GitHub", logo: "https://logos.composio.dev/api/github", description: "Code & issues", categories: ["Developer Tools"] },
  { slug: "instagram", name: "Instagram", logo: "https://logos.composio.dev/api/instagram", description: "Social", categories: ["Marketing"] },
  { slug: "twitter", name: "Twitter", logo: "https://logos.composio.dev/api/twitter", description: "Social", categories: ["Marketing"] },
  { slug: "slack", name: "Slack", logo: "https://logos.composio.dev/api/slack", description: "Team chat", categories: ["Communication"] },
  { slug: "notion", name: "Notion", logo: "https://logos.composio.dev/api/notion", description: "Docs & notes", categories: ["Documents"] },
  { slug: "linkedin", name: "LinkedIn", logo: "https://logos.composio.dev/api/linkedin", description: "Professional network", categories: ["Marketing"] },
  { slug: "discord", name: "Discord", logo: "https://logos.composio.dev/api/discord", description: "Community chat", categories: ["Communication"] },
  { slug: "shopify", name: "Shopify", logo: "https://logos.composio.dev/api/shopify", description: "Commerce", categories: ["Sales"] },
  { slug: "googlecalendar", name: "Google Calendar", logo: "https://logos.composio.dev/api/googlecalendar", description: "Calendar", categories: ["Productivity"] },
  { slug: "googledrive", name: "Google Drive", logo: "https://logos.composio.dev/api/googledrive", description: "Files", categories: ["Productivity"] },
];

/** GET — app catalogue for Connections (server-side only). */
export async function GET(req: NextRequest) {
  if (!composioConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "App connections aren’t available right now. Please try again later.",
        toolkits: [],
      },
      { status: 503 }
    );
  }

  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "48", 10) || 48)
    );

    let items = await fetchViaRest(Math.max(limit, 60));
    if (!items.length) items = await fetchViaSdk(Math.max(limit, 60));

    let toolkits = items
      .map(mapItem)
      .filter((t): t is ToolkitRow => Boolean(t));

    const seen = new Set<string>();
    toolkits = toolkits.filter((t) => {
      if (seen.has(t.slug)) return false;
      seen.add(t.slug);
      return true;
    });

    // If remote catalogue is empty, still surface popular connectable apps
    if (!toolkits.length) {
      toolkits = [...FALLBACK_APPS];
    }

    if (q) {
      toolkits = toolkits.filter(
        (t) =>
          t.slug.includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.categories.some((c) => c.toLowerCase().includes(q))
      );
    } else {
      const prefer = FALLBACK_APPS.map((a) => a.slug);
      toolkits.sort((a, b) => {
        const ia = prefer.indexOf(a.slug);
        const ib = prefer.indexOf(b.slug);
        const sa = ia === -1 ? 999 : ia;
        const sb = ib === -1 ? 999 : ib;
        return sa - sb || a.name.localeCompare(b.name);
      });
    }

    return NextResponse.json({
      ok: true,
      toolkits: toolkits.slice(0, limit),
      total: toolkits.length,
      nextCursor: null,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not load apps. Please try again.",
        toolkits: [],
      },
      { status: 500 }
    );
  }
}
