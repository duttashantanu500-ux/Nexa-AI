import { NextRequest, NextResponse } from "next/server";
import { composioConfigured, composioApiKey } from "@/lib/composio/client";

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
const CACHE_MS = 10 * 60 * 1000;

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
  if (raw.toolkits && Array.isArray(raw.toolkits.items))
    return raw.toolkits.items;
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
    raw.next_page_cursor ||
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
): Promise<{ items: any[]; cursor: string | null; httpStatus: number }> {
  const bases = [
    "https://backend.composio.dev/api/v3.1/toolkits",
    "https://backend.composio.dev/api/v3/toolkits",
  ];

  for (const base of bases) {
    const url = new URL(base);
    url.searchParams.set("limit", String(Math.min(1000, Math.max(1, limit))));
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
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return { items: [], cursor: null, httpStatus: res.status };
        }
        continue;
      }
      const raw = await res.json().catch(() => null);
      return {
        items: extractItems(raw),
        cursor: nextCursor(raw),
        httpStatus: res.status,
      };
    } catch {
      /* next */
    }
  }

  return { items: [], cursor: null, httpStatus: 0 };
}

async function loadViaRest(key: string): Promise<ToolkitRow[]> {
  const all: any[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < 8; i++) {
    const page = await fetchPageRest(key, 1000, cursor);
    if (page.httpStatus === 401 || page.httpStatus === 403) break;
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

  const items = await loadViaRest(key);
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
        error:
          "App connections aren’t available right now. Please try again later.",
        toolkits: [],
      },
      { status: 503 }
    );
  }

  const key = composioApiKey();
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "App connections aren’t available right now. Please try again later.",
        toolkits: [],
      },
      { status: 503 }
    );
  }

  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const limitParam = parseInt(
      req.nextUrl.searchParams.get("limit") || "2000",
      10
    );
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
