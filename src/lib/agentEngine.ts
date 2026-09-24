import { BusinessContext } from "@/types";
import { webSearch } from "./tools/webSearch";
import { readWebPage } from "./tools/pageReader";
import { ProspectRow, SearchHit } from "./tools/types";

export interface EnginePlanStep {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  tool?: string;
}

export interface EnginePlan {
  title: string;
  objective: string;
  steps: EnginePlanStep[];
  researchQuery?: string;
}

export interface EngineDeliverable {
  type: "lead_list" | "report" | "summary";
  title: string;
  content: string;
  rows?: ProspectRow[];
  sources: { title?: string; url: string }[];
  createdAt: string;
}

export interface EngineRunResult {
  ok: boolean;
  activity: string[];
  progress: number;
  status: "running" | "completed" | "failed" | "waiting_approval";
  steps: EnginePlanStep[];
  deliverable?: EngineDeliverable;
  error?: string;
}

function id() {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildPlan(
  goal: string,
  business?: BusinessContext | null
): EnginePlan {
  const g = goal.trim();
  const isResearch =
    /find|research|prospect|customer|lead|competitor|market|brand|compan/i.test(
      g
    );

  const industry = business?.industry || "";
  const target =
    business?.targetCustomer ||
    business?.targetCustomers ||
    business?.targetClients ||
    "";
  const location = business?.location || "";

  const researchQuery = [g, industry, target, location]
    .filter(Boolean)
    .join(" ")
    .slice(0, 180);

  if (isResearch) {
    return {
      title: g.length > 48 ? g.slice(0, 45) + "…" : g,
      objective: g,
      researchQuery,
      steps: [
        { id: id(), title: "Use business context", status: "pending" },
        {
          id: id(),
          title: "Web search for candidates",
          status: "pending",
          tool: "web_search",
        },
        {
          id: id(),
          title: "Read top candidate pages",
          status: "pending",
          tool: "web_page_reader",
        },
        {
          id: id(),
          title: "Qualify and structure results",
          status: "pending",
          tool: "structured_data",
        },
        { id: id(), title: "Produce deliverable", status: "pending" },
      ],
    };
  }

  return {
    title: g.length > 48 ? g.slice(0, 45) + "…" : g,
    objective: g,
    researchQuery,
    steps: [
      { id: id(), title: "Clarify objective from business context", status: "pending" },
      {
        id: id(),
        title: "Search for supporting information",
        status: "pending",
        tool: "web_search",
      },
      {
        id: id(),
        title: "Read key sources",
        status: "pending",
        tool: "web_page_reader",
      },
      { id: id(), title: "Write structured deliverable", status: "pending" },
    ],
  };
}

function buildSearchQueries(goal: string, business?: BusinessContext | null): string[] {
  const industry = business?.industry || "";
  const target =
    business?.targetCustomer ||
    business?.targetCustomers ||
    business?.targetClients ||
    "";
  const location = business?.location || "";
  const base = goal.replace(/[«»"']/g, "").trim();

  const queries = [
    base,
    [base, industry].filter(Boolean).join(" "),
    [base, "companies", location || "India"].filter(Boolean).join(" "),
    [target, industry, "company"].filter(Boolean).join(" "),
    // Known public directory-style queries (still searched, not hard-coded results)
    base.match(/saas/i) ? "list of Indian SaaS companies Wikipedia" : "",
    base.match(/saas/i) ? "Freshworks Zoho Chargebee Indian software company" : "",
  ].filter((q) => q && q.length > 3);

  return [...new Set(queries)].slice(0, 4);
}

export async function executeResearchMission(params: {
  goal: string;
  business?: BusinessContext | null;
  plan: EnginePlan;
  maxPages?: number;
}): Promise<EngineRunResult> {
  const activity: string[] = [];
  const steps = params.plan.steps.map((s) => ({ ...s }));
  const maxPages = params.maxPages ?? 8;
  const sources: { title?: string; url: string }[] = [];
  const rows: ProspectRow[] = [];

  const mark = (index: number, status: EnginePlanStep["status"]) => {
    if (steps[index]) steps[index] = { ...steps[index], status };
  };

  try {
    mark(0, "running");
    activity.push("Loaded business context");
    mark(0, "done");

    mark(1, "running");
    const queries = buildSearchQueries(params.goal, params.business);
    activity.push(`Web search started (${queries.length} queries)`);

    let hits: SearchHit[] = [];
    for (const q of queries) {
      activity.push(`Searching: "${q.slice(0, 80)}"`);
      const search = await webSearch(q, 10);
      if (!search.ok) {
        activity.push(`Search issue: ${search.error}`);
        continue;
      }
      const batch = ((search.data as any)?.hits || []) as SearchHit[];
      activity.push(`${batch.length} hits for query`);
      hits = dedupeHits([...hits, ...batch]);
      (search.sources || []).forEach((s) => sources.push(s));
      if (hits.length >= 12) break;
    }

    activity.push(`${hits.length} unique search results collected`);
    mark(1, hits.length > 0 ? "done" : "failed");

    if (hits.length === 0) {
      mark(2, "skipped");
      mark(3, "skipped");
      mark(4, "done");
      return {
        ok: true,
        activity,
        progress: 100,
        status: "completed",
        steps,
        deliverable: {
          type: "report",
          title: "Research results",
          content:
            "No public web results were found. Configure GEMINI_API_KEY (for Google Search grounding) or BRAVE_API_KEY / TAVILY_API_KEY / SERPER_API_KEY on Vercel for stronger search. Wikipedia fallback also ran but returned nothing for this query.",
          rows: [],
          sources: [],
          createdAt: new Date().toISOString(),
        },
      };
    }

    mark(2, "running");
    activity.push(`Reading up to ${Math.min(maxPages, hits.length)} pages`);
    let pagesRead = 0;

    for (const hit of hits.slice(0, maxPages)) {
      const page = await readWebPage(hit.url);
      if (!page.ok) {
        activity.push(`Could not read ${hit.url}: ${page.error}`);
        // Still keep search snippet as weak evidence
        if (hit.snippet && hit.snippet.length > 20) {
          rows.push({
            company: hit.title.split(/[-|–—|]/)[0].trim().slice(0, 80),
            website: hit.url,
            reason: "Appeared in search results (page body could not be fetched)",
            evidence: hit.snippet.slice(0, 220),
            source: hit.url,
          });
          sources.push({ title: hit.title, url: hit.url });
        }
        continue;
      }
      pagesRead++;
      const extract = page.data as { url: string; title: string; text: string };
      sources.push({ title: extract.title, url: extract.url });

      const company =
        extract.title.split(/[-|–—|]/)[0].trim().slice(0, 80) || hit.title;
      const snippet =
        extract.text.slice(0, 220) || hit.snippet || "No extractable text";

      rows.push({
        company,
        website: extract.url,
        reason: "Matched search intent and had a reachable public page",
        evidence: snippet,
        source: extract.url,
      });

      // From Wikipedia pages, pull external official-site links when present
      if (/wikipedia\.org/i.test(extract.url)) {
        const external = extractExternalUrls(extract.text, extract.url);
        for (const ext of external.slice(0, 2)) {
          sources.push({ title: company + " (external)", url: ext });
          rows.push({
            company,
            website: ext,
            reason: "External link found on Wikipedia page",
            evidence: snippet.slice(0, 120),
            source: extract.url,
          });
        }
      }
    }

    activity.push(`${pagesRead} websites analyzed`);
    mark(2, pagesRead > 0 || rows.length > 0 ? "done" : "failed");

    if (rows.length === 0) {
      mark(3, "failed");
      return {
        ok: false,
        activity,
        progress: 50,
        status: "failed",
        steps,
        error: "No pages could be read and no snippets available",
      };
    }

    mark(3, "running");
    const seen = new Set<string>();
    const qualified = rows.filter((r) => {
      const key = r.website.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return r.evidence.length > 15;
    });
    activity.push(`${qualified.length} items qualified from real evidence`);
    mark(3, "done");

    mark(4, "running");
    const lines = qualified.map(
      (r, i) =>
        `${i + 1}. ${r.company}\n   Website: ${r.website}\n   Why: ${r.reason}\n   Evidence: ${r.evidence}\n`
    );
    const content =
      `Research deliverable for: ${params.goal}\n\n` +
      `Found ${qualified.length} items with real evidence.\n\n` +
      lines.join("\n");

    activity.push(`Final report created (${qualified.length} rows)`);
    mark(4, "done");

    return {
      ok: true,
      activity,
      progress: 100,
      status: "completed",
      steps,
      deliverable: {
        type: "lead_list",
        title: `Results: ${params.goal.slice(0, 60)}`,
        content,
        rows: qualified,
        sources: dedupeSources(sources),
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    activity.push(`Engine error: ${err?.message || "unknown"}`);
    return {
      ok: false,
      activity,
      progress: 0,
      status: "failed",
      steps,
      error: err?.message || "Execution failed",
    };
  }
}

function dedupeHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (!h.url || seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });
}

function dedupeSources(list: { title?: string; url: string }[]) {
  const seen = new Set<string>();
  return list.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

/** Pull http(s) URLs from page text that look like official sites (not social/wiki). */
function extractExternalUrls(text: string, pageUrl: string): string[] {
  const found = text.match(/https?:\/\/[\w.-]+\.[a-z]{2,}[\w./?&=%+-]*/gi) || [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of found) {
    try {
      const url = new URL(u);
      if (/wikipedia\.|wikimedia\.|google\.|facebook\.|twitter\.|linkedin\.|youtube\./i.test(url.hostname))
        continue;
      if (url.hostname === new URL(pageUrl).hostname) continue;
      const clean = url.origin;
      if (seen.has(clean)) continue;
      seen.add(clean);
      out.push(clean);
    } catch {
      /* */
    }
  }
  return out.slice(0, 5);
}
