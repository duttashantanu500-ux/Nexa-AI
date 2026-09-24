import { PageExtract, ToolResult } from "./types";

/**
 * Fetch a public page and extract readable text.
 * Only returns content actually retrieved.
 */
export async function readWebPage(url: string): Promise<ToolResult> {
  const target = (url || "").trim();
  if (!/^https?:\/\//i.test(target)) {
    return { ok: false, tool: "web_page_reader", error: "Invalid URL" };
  }

  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NexaBot/1.0; +https://nexa-ai-beryl-one.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });

    if (!res.ok) {
      return {
        ok: false,
        tool: "web_page_reader",
        error: `Fetch failed (${res.status})`,
        sources: [{ url: target }],
      };
    }

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch
      ? stripTags(titleMatch[1]).trim().slice(0, 200)
      : target;

    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    const extract: PageExtract = { url: target, title, text };

    return {
      ok: true,
      tool: "web_page_reader",
      data: extract,
      sources: [{ title, url: target }],
    };
  } catch (err: any) {
    return {
      ok: false,
      tool: "web_page_reader",
      error: err?.message || "Page read failed",
      sources: [{ url: target }],
    };
  }
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}
