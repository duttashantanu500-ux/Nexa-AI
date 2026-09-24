import { SearchHit, ToolResult } from "./types";

/**
 * Multi-provider web search. Real hits only.
 * Order: Gemini grounding (if key) → Brave → Tavily → Serper → Wikipedia → DuckDuckGo
 */
export async function webSearch(query: string, limit = 10): Promise<ToolResult> {
  const q = (query || "").trim();
  if (!q) {
    return { ok: false, tool: "web_search", error: "Empty query" };
  }

  const providers: Array<{ name: string; run: () => Promise<SearchHit[]> }> = [
    { name: "gemini", run: () => searchGeminiGrounded(q, limit) },
    { name: "brave", run: () => searchBrave(q, limit) },
    { name: "tavily", run: () => searchTavily(q, limit) },
    { name: "serper", run: () => searchSerper(q, limit) },
    { name: "wikipedia", run: () => searchWikipedia(q, limit) },
    { name: "duckduckgo", run: () => searchDuckDuckGo(q, limit) },
  ];

  const errors: string[] = [];

  for (const p of providers) {
    try {
      const hits = await p.run();
      if (hits.length > 0) {
        const deduped = dedupe(hits).slice(0, limit);
        return {
          ok: true,
          tool: "web_search",
          data: { query: q, hits: deduped, provider: p.name },
          sources: deduped.map((h) => ({ title: h.title, url: h.url })),
        };
      }
    } catch (err: any) {
      errors.push(`${p.name}: ${err?.message || "error"}`);
    }
  }

  return {
    ok: true,
    tool: "web_search",
    data: { query: q, hits: [] },
    sources: [],
    error:
      errors.length > 0
        ? `All search providers returned empty. ${errors.slice(-3).join("; ")}`
        : "No search results",
  };
}

function env(...names: string[]) {
  for (const name of names) {
    const v = process.env[name];
    if (v && v.trim()) return v.trim();
  }
  return null;
}

async function searchBrave(q: string, limit: number): Promise<SearchHit[]> {
  const key = env("BRAVE_API_KEY", "BRAVE_SEARCH_API_KEY");
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
  return (data.web?.results || [])
    .map((r: any) => ({
      title: String(r.title || ""),
      url: String(r.url || ""),
      snippet: String(r.description || ""),
    }))
    .filter((h: SearchHit) => h.url.startsWith("http"));
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
  return (data.results || [])
    .map((r: any) => ({
      title: String(r.title || ""),
      url: String(r.url || ""),
      snippet: String(r.content || "").slice(0, 300),
    }))
    .filter((h: SearchHit) => h.url.startsWith("http"));
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
  return (data.organic || [])
    .map((r: any) => ({
      title: String(r.title || ""),
      url: String(r.link || ""),
      snippet: String(r.snippet || ""),
    }))
    .filter((h: SearchHit) => h.url.startsWith("http"));
}

/**
 * Gemini + Google Search grounding.
 * Tries multiple model + tool shapes used by the Generative Language API.
 */
async function searchGeminiGrounded(q: string, limit: number): Promise<SearchHit[]> {
  const key = env(
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY"
  );
  if (!key) return [];

  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
  ];

  // Different tool payload shapes Google has used
  const toolVariants: any[] = [
    [{ google_search: {} }],
    [{ googleSearch: {} }],
    [{ google_search_retrieval: {} }],
  ];

  for (const model of models) {
    for (const tools of toolVariants) {
      try {
        const hits = await callGeminiSearch(key, model, q, limit, tools);
        if (hits.length > 0) return hits.slice(0, limit);
      } catch {
        continue;
      }
    }
  }

  // Last try: no tools, ask for JSON with real URLs only (still may be weak)
  // Skip — we never invent. Return empty so next provider runs.
  return [];
}

async function callGeminiSearch(
  key: string,
  model: string,
  q: string,
  limit: number,
  tools: any
): Promise<SearchHit[]> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
    encodeURIComponent(key);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `Use Google Search to find real public web results for this query:\n"${q}"\n\n` +
                `Return a JSON array of up to ${limit} results. ` +
                `Each object must be: {"title":"...","url":"https://...","snippet":"..."}. ` +
                `Only include URLs from actual search results. No markdown fences, no commentary.`,
            },
          ],
        },
      ],
      tools,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${model} ${res.status} ${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  const hits: SearchHit[] = [];

  // Grounding chunks (authoritative)
  const meta = data.candidates?.[0]?.groundingMetadata || {};
  const chunks = meta.groundingChunks || [];
  for (const ch of chunks) {
    const w = ch.web || ch.retrievedContext;
    if (w?.uri || w?.url) {
      hits.push({
        title: String(w.title || w.uri || w.url),
        url: String(w.uri || w.url),
        snippet: "",
      });
    }
  }

  // groundingSupports → sometimes only has indices; also check webSearchQueries pages
  const attributions = meta.groundingSupports || [];
  for (const s of attributions) {
    // no direct URL usually
  }

  // Parse model text JSON
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || "")
      .join("") || "";
  hits.push(...parseJsonHits(text));

  // Extract bare URLs from text as last resort from grounded answer
  if (hits.length === 0 && text) {
    const urls = text.match(/https?:\/\/[^\s\]"']+/g) || [];
    for (const u of urls.slice(0, limit)) {
      hits.push({ title: u, url: u.replace(/[),\.]+$/, ""), snippet: "" });
    }
  }

  return dedupe(hits.filter((h) => /^https?:\/\//i.test(h.url)));
}

function parseJsonHits(text: string): SearchHit[] {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1));
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

async function searchWikipedia(q: string, limit: number): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];

  try {
    const openUrl =
      "https://en.wikipedia.org/w/api.php?action=opensearch&search=" +
      encodeURIComponent(q) +
      `&limit=${Math.min(limit, 10)}&namespace=0&format=json&origin=*`;
    const res = await fetch(openUrl, {
      headers: {
        "User-Agent": "NexaBot/1.0 (research; +https://nexa-ai-beryl-one.vercel.app)",
      },
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

  try {
    const searchUrl =
      "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
      encodeURIComponent(q) +
      `&srlimit=${Math.min(limit, 10)}&format=json&origin=*`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "NexaBot/1.0 (research; +https://nexa-ai-beryl-one.vercel.app)",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      for (const p of data.query?.search || []) {
        const title = String(p.title || "");
        if (!title) continue;
        hits.push({
          title,
          url:
            "https://en.wikipedia.org/wiki/" +
            encodeURIComponent(title.replace(/ /g, "_")),
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
