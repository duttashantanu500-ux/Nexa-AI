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
  discovered?: ProspectRow[];
  qualified?: ProspectRow[];
  unverified?: ProspectRow[];
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

function normalizeGoal(goal: string) {
  return goal
    .replace(/\bSaaS\b/gi, "software as a service")
    .replace(/\bB2B\b/gi, "business to business")
    .trim();
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

  const researchQuery = normalizeGoal(
    [g, industry, target, location].filter(Boolean).join(" ")
  ).slice(0, 180);

  if (isResearch) {
    return {
      title: g.length > 48 ? g.slice(0, 45) + "…" : g,
      objective: g,
      researchQuery,
      steps: [
        { id: id(), title: "Use business context", status: "pending" },
        { id: id(), title: "Web search for candidates", status: "pending", tool: "web_search" },
        { id: id(), title: "Read top candidate pages", status: "pending", tool: "web_page_reader" },
        { id: id(), title: "Qualify against mission goal", status: "pending", tool: "structured_data" },
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
      { id: id(), title: "Search for supporting information", status: "pending", tool: "web_search" },
      { id: id(), title: "Read key sources", status: "pending", tool: "web_page_reader" },
      { id: id(), title: "Write structured deliverable", status: "pending" },
    ],
  };
}

function buildSearchQueries(goal: string, business?: BusinessContext | null): string[] {
  const industry = business?.industry || "";
  const location = business?.location || "India";
  const base = normalizeGoal(goal.replace(/[«»"']/g, ""));

  const queries = [
    base,
    `${base} ${location} companies`,
    `software as a service companies ${location}`,
    `Indian software as a service companies list`,
    "Freshworks Zoho Postman Chargebee BrowserStack Unicommerce",
    industry ? `${industry} companies ${location}` : "",
  ].filter((q) => q && q.length > 3);

  return [...new Set(queries)].slice(0, 5);
}

function isNoiseHit(h: SearchHit): boolean {
  const t = `${h.title} ${h.snippet}`.toLowerCase();
  if (/kyunki saas|saas bahu|bahu thi|television series|tv series|film which was released/i.test(t))
    return true;
  if (/actress|actor|film director|soap opera/i.test(t)) return true;
  return false;
}

function looksLikeCompany(h: SearchHit): boolean {
  const t = `${h.title} ${h.snippet}`.toLowerCase();
  if (isNoiseHit(h)) return false;
  if (/inc\.?|ltd|limited|company|software|platform|startup|headquarter/i.test(t)) return true;
  if (/wikipedia\.org\/wiki\//i.test(h.url) && /\(company\)/i.test(h.title)) return true;
  return !/wikipedia\.org\/wiki\//i.test(h.url);
}

/** Heuristic relevance to goal — conservative, never invents. */
function qualifyAgainstGoal(
  row: ProspectRow,
  goal: string
): "qualified" | "discovered" | "unverified" {
  const g = goal.toLowerCase();
  const blob = `${row.company} ${row.evidence} ${row.reason}`.toLowerCase();

  const wantsIndia = /india|indian/.test(g);
  const wantsSaas = /saas|software as a service|software/.test(g);
  const wantsCompany = /compan|startup|business|customer|lead|prospect/.test(g);

  let score = 0;
  if (wantsIndia && /india|indian|bangalore|bengaluru|mumbai|delhi|hyderabad|chennai|pune|gurugram|gurgaon/.test(blob))
    score += 2;
  if (wantsSaas && /software|saas|platform|cloud|subscription|b2b/.test(blob)) score += 2;
  if (wantsCompany && /company|inc|ltd|limited|startup|headquarter/.test(blob)) score += 1;
  if (/wikipedia\.org/i.test(row.website) && !/\(company\)/i.test(row.company)) score -= 1;
  if (row.evidence.length < 40) return "unverified";
  if (score >= 3) return "qualified";
  if (score >= 1) return "discovered";
  return "unverified";
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
      activity.push(`Searching: "${q.slice(0, 90)}"`);
      const search = await webSearch(q, 10);
      if (!search.ok) {
        activity.push(`Search issue: search unavailable for this query`);
        continue;
      }
      const batch = (((search.data as any)?.hits || []) as SearchHit[]).filter(
        (h) => !isNoiseHit(h)
      );
      activity.push(`${batch.length} usable hits`);
      hits = dedupeHits([...hits, ...batch]);
      (search.sources || []).forEach((s) => sources.push(s));
      if (hits.filter(looksLikeCompany).length >= 10) break;
    }

    hits = dedupeHits([
      ...hits.filter(looksLikeCompany),
      ...hits.filter((h) => !looksLikeCompany(h)),
    ]);

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
            "No public web results were found for this query. Try different keywords or try again later.",
          rows: [],
          discovered: [],
          qualified: [],
          unverified: [],
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
        activity.push(`Could not read a page`);
        if (hit.snippet && hit.snippet.length > 20 && !isNoiseHit(hit)) {
          rows.push({
            company: cleanTitle(hit.title),
            website: hit.url,
            reason: "Found in search; page body could not be verified",
            evidence: hit.snippet.slice(0, 220),
            source: hit.url,
            qualification: "unverified",
          });
          sources.push({ title: hit.title, url: hit.url });
        }
        continue;
      }
      pagesRead++;
      const extract = page.data as { url: string; title: string; text: string };
      sources.push({ title: extract.title, url: extract.url });

      const company = cleanTitle(extract.title || hit.title);
      const snippet = cleanWikiText(extract.text).slice(0, 280) || hit.snippet;

      if (isNoiseHit({ title: company, url: extract.url, snippet })) continue;

      rows.push({
        company,
        website: extract.url,
        reason: "Public page found and read",
        evidence: snippet,
        source: extract.url,
      });

      if (/wikipedia\.org/i.test(extract.url)) {
        const external = extractExternalUrls(extract.text, extract.url);
        for (const ext of external.slice(0, 2)) {
          sources.push({ title: company + " site", url: ext });
          rows.push({
            company,
            website: ext,
            reason: "External link found on reference page",
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
        error: "No usable pages after filtering",
      };
    }

    mark(3, "running");
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      const key = r.website.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const tagged = unique.map((r) => ({
      ...r,
      qualification: r.qualification || qualifyAgainstGoal(r, params.goal),
    }));

    const qualified = tagged.filter((r) => r.qualification === "qualified");
    const discovered = tagged.filter((r) => r.qualification === "discovered");
    const unverified = tagged.filter((r) => r.qualification === "unverified");

    activity.push(
      `Qualified ${qualified.length} · Discovered ${discovered.length} · Unverified ${unverified.length}`
    );
    mark(3, "done");

    mark(4, "running");
    const section = (title: string, list: ProspectRow[]) => {
      if (!list.length) return `${title}: none\n`;
      return (
        `${title} (${list.length}):\n` +
        list
          .map(
            (r, i) =>
              `${i + 1}. ${r.company}\n   Website: ${r.website}\n   Why: ${r.reason}\n   Evidence: ${r.evidence}\n`
          )
          .join("\n") +
        "\n"
      );
    };

    const content =
      `Research for: ${params.goal}\n\n` +
      section("Qualified companies", qualified) +
      "\n" +
      section("Discovered websites", discovered) +
      "\n" +
      section("Unable to verify", unverified);

    activity.push("Final report created");
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
        rows: tagged,
        qualified,
        discovered,
        unverified,
        sources: dedupeSources(sources),
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    activity.push("Engine error");
    return {
      ok: false,
      activity,
      progress: 0,
      status: "failed",
      steps,
      error: "Execution failed. Please try again.",
    };
  }
}

function cleanTitle(t: string) {
  return t
    .replace(/ - Wikipedia$/i, "")
    .split(/[-|–—|]/)[0]
    .trim()
    .slice(0, 80);
}

function cleanWikiText(text: string) {
  return text
    .replace(/Jump to content[\s\S]*?Main menu/gi, " ")
    .replace(/Main menu[\s\S]*?Navigation/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
