import { SearchHit, ToolResult } from "./types";

/**
 * Multi-provider web search. Returns real hits only — never invents URLs.
 * Order: Brave → Tavily → Serper → Gemini Google Search grounding → Wikipedia → DuckDuckGo
 */
export async function webSearch(query: string, limit = 10): Promise<ToolResult> {
  const q = (query || "").trim();
  if (!q) {
    return { ok: false, tool: "web_search", error: "Empty query" };
  }

  const providers: Array<() => Promise<SearchHit[]>> = [
    () => searchBrave(q, limit),
    () => searchTavily(q, limit),
    () => searchSerper(q, limit),
    () => searchGeminiGrounded(q, limit),
    () => searchWikipedia(q, limit),
    () => searchDuckDuckGo(q, limit),
  ];

  const errors: string[] = [];

  for (const run of providers) {
    try {
      const hits = await run();
      if (hits.length > 0) {
        const deduped = dedupe(hits).slice(0, limit);
        return {
          ok: true,
          tool: "web_search",
          data: { query: q, hits: deduped },
          sources: deduped.map((h) => ({ title: h.title, url: h.url })),
        };
      }
    } catch (err: any) {
      errors.push(err?.message || "provider error");
    }
  }

  return {
    ok: true,
    tool: "web_search",
    data: { query: q, hits: [] },
    sources: [],
    error:
      errors.length > 0
        ? `All search providers returned empty. Last errors: ${errors.slice(-2).join("; ")}`
        : "No search results",
  };
}

function env(name: string) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

async function searchBrave(q: string, limit: number): Promise<SearchHit[]> {
  const key = env("BRAVE_API_KEY") || env("BRAVE_SEARCH_API_KEY");
  if (!key) return [];
  const url =
    "https://api.search.brave.com/res/v1/web/search?q=" +
    encodeURIComponent(q) +
    `&count=${Math.min(limit, 20)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const data = await res.json();
  const results = data.web?.results || [];
  return results.map((r: any) => ({
    title: String(r.title || ""),
    url: String(r.url || ""),
    snippet: String(r.description || ""),
  })).filter((h: SearchHit) => h.url.startsWith("http"));
}

async function searchTavily(q: string, limit: number): Promise<SearchHit[]> {
  const key = env("TAVILY_API_KEY");
  if (!key) return [];
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query: q,
      max_results: Math.min(limit, 15),
      include_answer: false,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r: any) => ({
    title: String(r.title || ""),
    url: String(r.url || ""),
    snippet: String(r.content || "").slice(0, 300),
  })).filter((h: SearchHit) => h.url.startsWith("http"));
}

async function searchSerper(q: string, limit: number): Promise<SearchHit[]> {
  const key = env("SERPER_API_KEY");
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": key,
    },
    body: JSON.stringify({ q, num: Math.min(limit, 15) }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = await res.json();
  return (data.organic || []).map((r: any) => ({
    title: String(r.title || ""),
    url: String(r.link || ""),
    snippet: String(r.snippet || ""),
  })).filter((h: SearchHit) => h.url.startsWith("http"));
}

/** Gemini with Google Search grounding — real web results when key is set */
async function searchGeminiGrounded(q: string, limit: number): Promise<SearchHit[]> {
  const key =
    env("GEMINI_API_KEY") ||
    env("GOOGLE_API_KEY") ||
    env("GOOGLE_GENERATIVE_AI_API_KEY");
  if (!key) return [];

  const models = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `Search the public web for: ${q}\n\n` +
                    `Return ONLY a JSON array of up to ${limit} real results. ` +
                    `Each item: {"title":"...","url":"https://...","snippet":"..."}. ` +
                    `Only include URLs you actually found via search. No markdown, no commentary.`,
                },
              ],
            },
          ],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      // Prefer grounding metadata URLs (definitely real)
      const grounded: SearchHit[] = [];
      const chunks =
        data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      for (const ch of chunks) {
        const w = ch.web;
        if (w?.uri) {
          grounded.push({
            title: String(w.title || w.uri),
            url: String(w.uri),
            snippet: "",
          });
        }
      }

      // Also parse JSON array from model text if present
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text || "")
          .join("") || "";
      const fromText = parseJsonHits(text);

      const combined = dedupe([...grounded, ...fromText]);
      if (combined.length > 0) return combined.slice(0, limit);
    } catch {
      continue;
    }
  }
  return [];
}

function parseJsonHits(text: string): SearchHit[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .map((r: any) => ({
        title: String(r.title || ""),
        url: String(r.url || r.link || ""),
        snippet: String(r.snippet || r.description || ""),
      }))
      .filter((h: SearchHit) => /^https?:\/\//i.test(h.url));
  } catch {
    return [];
  }
}

/** Always-on free fallback via Wikipedia OpenSearch + search API */
async function searchWikipedia(q: string, limit: number): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];

  // OpenSearch
  try {
    const openUrl =
      "https://en.wikipedia.org/w/api.php?action=opensearch&search=" +
      encodeURIComponent(q) +
      `&limit=${Math.min(limit, 10)}&namespace=0&format=json&origin=*`;
    const res = await fetch(openUrl, {
      headers: { "User-Agent": "NexaBot/1.0 (research; +https://nexa-ai-beryl-one.vercel.app)" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      const titles: string[] = data[1] || [];
      const descs: string[] = data[2] || [];
      const urls: string[] = data[3] || [];
      for (let i = 0; i < urls.length; i++) {
        if (urls[i]) {
          hits.push({
            title: titles[i] || urls[i],
            url: urls[i],
            snippet: descs[i] || "",
          });
        }
      }
    }
  } catch {
    /* */
  }

  // Full-text search for more business-relevant pages
  try {
    const searchUrl =
      "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
      encodeURIComponent(q) +
      `&srlimit=${Math.min(limit, 10)}&format=json&origin=*`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "NexaBot/1.0 (research; +https://nexa-ai-beryl-one.vercel.app)" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.search || [];
      for (const p of pages) {
        const title = String(p.title || "");
        if (!title) continue;
        hits.push({
          title,
          url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_")),
          snippet: stripTags(String(p.snippet || "")),
        });
      }
    }
  } catch {
    /* */
  }

  return dedupe(hits).slice(0, limit);
}

async function searchDuckDuckGo(q: string, limit: number): Promise<SearchHit[]> {
  try {
    const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseDuckDuckGoHtml(html).slice(0, limit);
  } catch {
    return [];
  }
}

function parseDuckDuckGoHtml(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
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
  return hits;
}

function dedupe(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (!h.url || seen.has(h.url)) return false;
    seen.add(h.url);
    return Boolean(h.title);
  });
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(s: string) {
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
