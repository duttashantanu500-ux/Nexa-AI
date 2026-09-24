import { PageExtract, ToolResult } from "./types";

/**
 * Fetch a public page and extract readable text + meta description.
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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

    const metaDesc =
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i
      );
    const ogDesc =
      html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:description["']/i
      );

    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    const metaBits = [
      metaDesc?.[1] ? stripTags(metaDesc[1]) : "",
      ogDesc?.[1] ? stripTags(ogDesc[1]) : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (metaBits) {
      text = (metaBits + " " + text).slice(0, 8000);
    } else {
      text = text.slice(0, 8000);
    }

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
