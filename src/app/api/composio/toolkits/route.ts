import { NextRequest, NextResponse } from "next/server";
import { composioConfigured, getComposio } from "@/lib/composio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/composio/toolkits?q=&cursor=&limit=
 * Returns Composio toolkit catalogue (server-side only).
 */
export async function GET(req: NextRequest) {
  if (!composioConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Composio is not configured on this server. Set COMPOSIO_API_KEY to enable the marketplace.",
        toolkits: [],
      },
      { status: 503 }
    );
  }

  try {
    const composio = getComposio();
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "48", 10) || 48)
    );
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;

    // Prefer SDK list; fall back to empty on shape differences
    let raw: any = null;
    try {
      raw = await (composio.toolkits as any).get(
        cursor ? { cursor, limit } : { limit }
      );
    } catch {
      try {
        raw = await (composio.toolkits as any).list?.({ cursor, limit });
      } catch {
        raw = null;
      }
    }

    const items = Array.isArray(raw)
      ? raw
      : raw?.items || raw?.data || raw?.toolkits || [];

    let toolkits = (Array.isArray(items) ? items : []).map((t: any) => {
      const slug = String(t.slug || t.key || t.appKey || t.name || "").toLowerCase();
      const name = String(t.name || t.displayName || slug);
      const logo =
        t.logo ||
        t.meta?.logo ||
        t.meta?.app_url_logo ||
        t.icon ||
        (slug
          ? `https://logos.composio.dev/api/${encodeURIComponent(slug)}`
          : "");
      const description = String(
        t.description || t.meta?.description || t.shortDescription || ""
      );
      const categories = Array.isArray(t.categories)
        ? t.categories.map((c: any) => String(c.name || c))
        : Array.isArray(t.meta?.categories)
          ? t.meta.categories.map((c: any) => String(c.name || c))
          : [];
      return {
        slug,
        name,
        logo,
        description,
        categories,
        authSchemes: t.authSchemes || t.auth_schemes || [],
      };
    });

    if (q) {
      toolkits = toolkits.filter(
        (t: any) =>
          t.slug.includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.categories.some((c: string) => c.toLowerCase().includes(q))
      );
    }

    // Client-side page slice when API returns full list
    const page = toolkits.slice(0, limit);

    return NextResponse.json({
      ok: true,
      toolkits: page,
      total: toolkits.length,
      nextCursor: raw?.nextCursor || raw?.next_cursor || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Failed to load integrations catalogue",
        toolkits: [],
      },
      { status: 500 }
    );
  }
}
