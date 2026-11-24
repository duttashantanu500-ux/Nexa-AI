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

let cache: { at: number; items: ToolkitRow[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

function mapItem(t: any): ToolkitRow | null {
  const slug = String(
    t.slug || t.key || t.appKey || t.toolkit_slug || t.appName || t.name || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!slug) return null;

  const name = String(
    t.name || t.displayName || t.display_name || t.appName || slug
  );

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
    ? t.categories.map((c: any) => String(c?.name || c)).filter(Boolean)
    : Array.isArray(t.meta?.categories)
      ? t.meta.categories.map((c: any) => String(c?.name || c)).filter(Boolean)
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

function nextCursor(raw: any): string | null {
  if (!raw || typeof raw !== "object") return null;
  const c =
    raw.next_cursor ||
    raw.nextCursor ||
    raw.cursor?.next ||
    raw.pagination?.next_cursor ||
    raw.pagination?.nextCursor ||
    null;
  return c ? String(c) : null;
}

function dedupeMap(items: any[]): ToolkitRow[] {
  const out: ToolkitRow[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const row = mapItem(raw);
    if (!row || seen.has(row.slug)) continue;
    seen.add(row.slug);
    out.push(row);
  }
  return out;
}

async function fetchPageRest(
  key: string,
  limit: number,
  cursor?: string | null,
  search?: string
): Promise<{ items: any[]; cursor: string | null }> {
  const bases = [
    "https://backend.composio.dev/api/v3.1/toolkits",
    "https://backend.composio.dev/api/v3/toolkits",
  ];

  for (const base of bases) {
    const url = new URL(base);
    url.searchParams.set("limit", String(Math.min(1000, Math.max(1, limit))));
    url.searchParams.set("sort_by", "usage");
    if (cursor) url.searchParams.set("cursor", cursor);
    if (search) url.searchParams.set("search", search);

    try {
      const res = await fetch(url.toString(), {
        headers: {
          "x-api-key": key,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const raw = await res.json().catch(() => null);
      return {
        items: extractItems(raw),
        cursor: nextCursor(raw),
      };
    } catch {
      /* next */
    }
  }

  return { items: [], cursor: null };
}

async function loadViaSdk(): Promise<ToolkitRow[]> {
  try {
    const composio = getComposio();
    const tk = composio.toolkits as any;
    const all: any[] = [];
    let cursor: string | undefined;

    for (let i = 0; i < 6; i++) {
      let page: any = null;
      if (typeof tk.list === "function") {
        page = await tk.list({
          limit: 1000,
          cursor,
          sortBy: "usage",
          sort_by: "usage",
        });
      } else if (typeof tk.get === "function") {
        page = await tk.get({ limit: 1000, cursor });
      }
      const items = extractItems(page);
      all.push(...items);
      const next = nextCursor(page);
      if (!next || items.length === 0) break;
      cursor = next;
    }
    return dedupeMap(all);
  } catch {
    return [];
  }
}

async function loadViaRest(key: string): Promise<ToolkitRow[]> {
  const all: any[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < 6; i++) {
    const page = await fetchPageRest(key, 1000, cursor);
    all.push(...page.items);
    if (!page.cursor || page.items.length === 0) break;
    cursor = page.cursor;
  }
  return dedupeMap(all);
}

async function loadAllToolkits(key: string): Promise<ToolkitRow[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.items;
  }

  let items = await loadViaSdk();
  if (items.length < 50) {
    const rest = await loadViaRest(key);
    if (rest.length > items.length) items = rest;
  }

  if (items.length > 0) {
    cache = { at: Date.now(), items };
  }
  return items;
}

/** GET — full app catalogue for Connections. */
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

  const key = process.env.COMPOSIO_API_KEY?.trim() || "";
  if (!key) {
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
    const limitParam = parseInt(req.nextUrl.searchParams.get("limit") || "2000", 10);
    const limit = Math.min(
      2500,
      Math.max(1, Number.isFinite(limitParam) ? limitParam : 2000)
    );

    let toolkits = await loadAllToolkits(key);

    if (q) {
      const remote = await fetchPageRest(key, 1000, null, q);
      const seen = new Set(toolkits.map((t) => t.slug));
      for (const row of dedupeMap(remote.items)) {
        if (!seen.has(row.slug)) {
          seen.add(row.slug);
          toolkits.push(row);
        }
      }
      toolkits = toolkits.filter(
        (t) =>
          t.slug.includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.categories.some((c) => c.toLowerCase().includes(q))
      );
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
