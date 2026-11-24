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
    t.slug || t.key || t.appKey || t.toolkit_slug || t.name || ""
  )
    .trim()
    .toLowerCase();
  if (!slug) return null;
  const name = String(t.name || t.displayName || t.display_name || slug);
  const logo = String(
    t.logo ||
      t.meta?.logo ||
      t.meta?.app_url_logo ||
      t.icon ||
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

async function fetchViaRest(limit: number, cursor?: string): Promise<any> {
  const key = process.env.COMPOSIO_API_KEY?.trim();
  if (!key) return null;
  const url = new URL("https://backend.composio.dev/api/v3/toolkits");
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url.toString(), {
    headers: {
      "x-api-key": key,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    // try v2 apps list
    const res2 = await fetch(
      `https://backend.composio.dev/api/v2/apps?limit=${limit}`,
      {
        headers: { "x-api-key": key, Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res2.ok) return null;
    return res2.json().catch(() => null);
  }
  return res.json().catch(() => null);
}

async function fetchViaSdk(limit: number, cursor?: string): Promise<any> {
  try {
    const composio = getComposio();
    const tk = composio.toolkits as any;
    if (typeof tk.get === "function") {
      return await tk.get(cursor ? { cursor, limit } : { limit });
    }
    if (typeof tk.list === "function") {
      return await tk.list({ cursor, limit });
    }
  } catch {
    /* */
  }
  return null;
}

function extractItems(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.toolkits)) return raw.toolkits;
  if (Array.isArray(raw.apps)) return raw.apps;
  if (Array.isArray(raw.results)) return raw.results;
  return [];
}

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
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;

    let raw = await fetchViaRest(Math.max(limit, 50), cursor);
    let items = extractItems(raw);

    if (!items.length) {
      raw = await fetchViaSdk(Math.max(limit, 50), cursor);
      items = extractItems(raw);
    }

    let toolkits = items
      .map(mapItem)
      .filter((t): t is ToolkitRow => Boolean(t));

    // De-dupe by slug
    const seen = new Set<string>();
    toolkits = toolkits.filter((t) => {
      if (seen.has(t.slug)) return false;
      seen.add(t.slug);
      return true;
    });

    if (q) {
      toolkits = toolkits.filter(
        (t) =>
          t.slug.includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.categories.some((c) => c.toLowerCase().includes(q))
      );
    }

    // Prefer well-known apps first when no search
    if (!q) {
      const prefer = [
        "gmail",
        "outlook",
        "github",
        "instagram",
        "twitter",
        "slack",
        "notion",
        "linkedin",
        "discord",
        "shopify",
        "googlecalendar",
        "googledrive",
      ];
      toolkits.sort((a, b) => {
        const ia = prefer.indexOf(a.slug);
        const ib = prefer.indexOf(b.slug);
        const sa = ia === -1 ? 999 : ia;
        const sb = ib === -1 ? 999 : ib;
        return sa - sb || a.name.localeCompare(b.name);
      });
    }

    const page = toolkits.slice(0, limit);

    return NextResponse.json({
      ok: true,
      toolkits: page,
      total: toolkits.length,
      nextCursor: raw?.nextCursor || raw?.next_cursor || null,
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
