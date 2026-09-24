import { SearchHit, ToolResult } from "./types";

/**
 * Server-side web search via DuckDuckGo HTML results.
 * Returns real hits only — never invents URLs.
 */
export async function webSearch(query: string, limit = 10): Promise<ToolResult> {
  const q = (query || "").trim();
  if (!q) {
    return { ok: false, tool: "web_search", error: "Empty query" };
  }

  try {
    const url =
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NexaBot/1.0; +https://nexa-ai-beryl-one.vercel.app)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return {
        ok: false,
        tool: "web_search",
        error: `Search failed (${res.status})`,
      };
    }

    const html = await res.text();
    const hits = parseDuckDuckGoHtml(html).slice(0, limit);

    return {
      ok: true,
      tool: "web_search",
      data: { query: q, hits },
      sources: hits.map((h) => ({ title: h.title, url: h.url })),
    };
  } catch (err: any) {
    return {
      ok: false,
      tool: "web_search",
      error: err?.message || "Search request failed",
    };
  }
}

function parseDuckDuckGoHtml(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  // result blocks
  const blockRe =
    /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/)/gi;

  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    let href = decodeHtml(m[1] || "");
    const title = stripTags(decodeHtml(m[2] || "")).trim();
    const snippet = stripTags(decodeHtml(m[3] || "")).trim();

    // DuckDuckGo sometimes wraps redirects
    const uddg = href.match(/uddg=([^&]+)/);
    if (uddg) {
      try {
        href = decodeURIComponent(uddg[1]);
      } catch {
        /* keep */
      }
    }

    if (!href.startsWith("http")) continue;
    if (!title) continue;

    hits.push({ title, url: href, snippet });
  }

  // Fallback simpler parse
  if (hits.length === 0) {
    const simple =
      /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let s: RegExpExecArray | null;
    while ((s = simple.exec(html)) !== null) {
      let href = decodeHtml(s[1] || "");
      const title = stripTags(decodeHtml(s[2] || "")).trim();
      const uddg = href.match(/uddg=([^&]+)/);
      if (uddg) {
        try {
          href = decodeURIComponent(uddg[1]);
        } catch {
          /* */
        }
      }
      if (href.startsWith("http") && title) {
        hits.push({ title, url: href, snippet: "" });
      }
    }
  }

  // Dedupe by URL
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function decodeHtml(s: string) {
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}
