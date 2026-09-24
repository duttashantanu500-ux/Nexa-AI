import { BusinessContext } from "@/types";
import { webSearch } from "./tools/webSearch";
import { readWebPage } from "./tools/pageReader";
import { ProspectRow, SearchHit } from "./tools/types";
import { parseMissionRequirements, MissionRequirements } from "./missionParse";

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
  requirements?: MissionRequirements;
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

export function buildPlan(
  goal: string,
  _business?: BusinessContext | null
): EnginePlan {
  const g = goal.trim();
  const req = parseMissionRequirements(g);

  return {
    title: g.length > 56 ? g.slice(0, 53) + "…" : g,
    objective: g,
    researchQuery: req.searchQueries[0],
    requirements: req,
    steps: [
      { id: id(), title: "Parse mission requirements", status: "pending" },
      {
        id: id(),
        title: `Search for ${req.category}${req.location ? ` in ${req.location}` : ""}`,
        status: "pending",
        tool: "web_search",
      },
      {
        id: id(),
        title: "Read candidate pages",
        status: "pending",
        tool: "web_page_reader",
      },
      {
        id: id(),
        title: "Filter results against your request",
        status: "pending",
        tool: "structured_data",
      },
      { id: id(), title: "Produce deliverable", status: "pending" },
    ],
  };
}

function isNoiseHit(h: SearchHit, req: MissionRequirements): boolean {
  const t = `${h.title} ${h.snippet}`.toLowerCase();
  if (/television series|tv series|soap opera|film director|actress|actor|\(film\)|biography of/i.test(t))
    return true;
  if (/kyunki saas|saas bahu|bahu thi/i.test(t)) return true;
  if (/shopping mall|road \(|relief of /i.test(t) && /restaurant|gym|cafe/i.test(req.category))
    return true;

  for (const ex of req.excludeTerms) {
    if (t.includes(ex) && !req.rawGoal.toLowerCase().includes(ex)) {
      const hasCategory = req.mustMatchTerms.some((m) => t.includes(m));
      if (!hasCategory) return true;
    }
  }
  return false;
}

/** Prefer real business sites over encyclopedic/list pages */
function rankHits(hits: SearchHit[], req: MissionRequirements): SearchHit[] {
  const score = (h: SearchHit) => {
    let s = 0;
    const t = `${h.title} ${h.snippet} ${h.url}`.toLowerCase();
    for (const term of req.mustMatchTerms) {
      if (t.includes(term)) s += 3;
    }
    if (req.location && t.includes(req.location.toLowerCase())) s += 4;
    if (/wikipedia\.org/i.test(h.url)) s -= 3;
    if (/zomato|tripadvisor|yelp|yelp\.|justdial|sulekha|magicbricks|99acres/i.test(h.url))
      s += 2;
    if (/\.(com|in|co|io|net)\b/i.test(h.url) && !/wikipedia/i.test(h.url)) s += 1;
    if (/list of|directory/i.test(t)) s += 1;
    return s;
  };
  return [...hits].sort((a, b) => score(b) - score(a));
}

function relevanceScore(row: ProspectRow, req: MissionRequirements): number {
  const blob = `${row.company} ${row.evidence} ${row.reason} ${row.website}`.toLowerCase();
  let score = 0;

  for (const term of req.mustMatchTerms) {
    if (blob.includes(term)) score += 2;
  }
  if (req.location) {
    if (blob.includes(req.location.toLowerCase())) score += 3;
  }
  if (req.qualification) {
    const words = req.qualification
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    for (const w of words.slice(0, 4)) {
      if (blob.includes(w)) score += 1;
    }
  }
  if (/wikipedia\.org/i.test(row.website)) score -= 2;
  if (
    !/saas|software|app|platform/i.test(req.category) &&
    /saas|software as a service|cloud crm|b2b software/i.test(blob)
  ) {
    score -= 5;
  }
  if (row.evidence.length < 30) score -= 1;
  return score;
}

function qualify(
  row: ProspectRow,
  req: MissionRequirements
): "qualified" | "discovered" | "unverified" {
  const score = relevanceScore(row, req);
  if (score >= 4) return "qualified";
  if (score >= 2) return "discovered";
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

  const req =
    params.plan.requirements || parseMissionRequirements(params.goal);

  const mark = (index: number, status: EnginePlanStep["status"]) => {
    if (steps[index]) steps[index] = { ...steps[index], status };
  };

  try {
    mark(0, "running");
    activity.push(
      `Requirements: category="${req.category}"` +
        (req.location ? `, location="${req.location}"` : "") +
        (req.quantity ? `, quantity=${req.quantity}` : "") +
        (req.qualification ? `, qualification="${req.qualification}"` : "")
    );
    mark(0, "done");

    mark(1, "running");
    activity.push(
      `Web search for ${req.category}${req.location ? ` in ${req.location}` : ""}`
    );

    let hits: SearchHit[] = [];
    for (const q of req.searchQueries) {
      activity.push(`Searching: "${q.slice(0, 100)}"`);
      const search = await webSearch(q, 12);
      if (!search.ok) {
        activity.push("Search unavailable for one query");
        continue;
      }
      const batch = (((search.data as any)?.hits || []) as SearchHit[]).filter(
        (h) => !isNoiseHit(h, req)
      );
      activity.push(`${batch.length} usable hits`);
      hits = dedupeHits([...hits, ...batch]);
      (search.sources || []).forEach((s) => sources.push(s));
      if (hits.length >= 20) break;
    }

    hits = rankHits(hits, req);
    activity.push(`${hits.length} unique results collected`);
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
          content: `No public web results were found for "${req.category}"${
            req.location ? ` in ${req.location}` : ""
          }. Try different keywords.`,
          rows: [],
          qualified: [],
          discovered: [],
          unverified: [],
          sources: [],
          createdAt: new Date().toISOString(),
        },
      };
    }

    mark(2, "running");
    // Prefer non-wiki pages first when reading
    const ordered = [
      ...hits.filter((h) => !/wikipedia\.org/i.test(h.url)),
      ...hits.filter((h) => /wikipedia\.org/i.test(h.url)),
    ];
    activity.push(`Reading up to ${Math.min(maxPages, ordered.length)} pages`);
    let pagesRead = 0;

    for (const hit of ordered.slice(0, maxPages)) {
      const page = await readWebPage(hit.url);
      if (!page.ok) {
        if (hit.snippet && hit.snippet.length > 20 && !isNoiseHit(hit, req)) {
          rows.push({
            company: cleanTitle(hit.title),
            website: hit.url,
            reason: "Found in search; page could not be fully verified",
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
      const snippet = cleanText(extract.text).slice(0, 280) || hit.snippet;

      if (isNoiseHit({ title: company, url: extract.url, snippet }, req)) continue;

      rows.push({
        company,
        website: extract.url,
        reason: `Matched search for ${req.category}`,
        evidence: snippet,
        source: extract.url,
      });
    }

    activity.push(`${pagesRead} pages analyzed`);
    mark(2, pagesRead > 0 || rows.length > 0 ? "done" : "failed");

    if (rows.length === 0) {
      mark(3, "failed");
      return {
        ok: false,
        activity,
        progress: 50,
        status: "failed",
        steps,
        error: "No usable pages after reading",
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
      qualification: r.qualification || qualify(r, req),
    }));

    const filtered = tagged.filter((r) => {
      if (/saas|software|app|platform/i.test(req.category)) return true;
      const blob = `${r.company} ${r.evidence}`.toLowerCase();
      const isSoftwareOnly =
        /saas|software as a service|cloud crm/i.test(blob) &&
        !req.mustMatchTerms.some((t) => blob.includes(t));
      return !isSoftwareOnly;
    });

    const qualified = filtered.filter((r) => r.qualification === "qualified");
    const discovered = filtered.filter((r) => r.qualification === "discovered");
    const unverified = filtered.filter((r) => r.qualification === "unverified");

    const limit = req.quantity || 50;
    const qSlice = qualified.slice(0, limit);
    const dSlice = discovered.slice(0, Math.max(0, limit - qSlice.length));

    activity.push(
      `Qualified ${qSlice.length} · Discovered ${discovered.length} · Unverified ${unverified.length}`
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
      `Research for: ${params.goal}\n` +
      `Category: ${req.category}` +
      (req.location ? ` · Location: ${req.location}` : "") +
      `\n\n` +
      section("Qualified", qSlice) +
      "\n" +
      section("Discovered", dSlice) +
      "\n" +
      section("Unable to verify", unverified.slice(0, 10)) +
      (filtered.length < (req.quantity || 0)
        ? `\nNote: Found ${filtered.length} relevant items; fewer than the requested ${req.quantity}.\n`
        : "");

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
        rows: filtered,
        qualified: qSlice,
        discovered: dSlice,
        unverified,
        sources: dedupeSources(sources),
        createdAt: new Date().toISOString(),
      },
    };
  } catch {
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

function cleanText(text: string) {
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
