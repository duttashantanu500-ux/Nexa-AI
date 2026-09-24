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

/** Deterministic plan from goal + business brain (no fake tools). */
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
  const biz = business?.businessName || "";

  const researchQuery = [g, industry, target, biz, "official website"]
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

/**
 * Execute a research-style mission with real tools only.
 * Bounded: max searches, max pages, max time per call.
 */
export async function executeResearchMission(params: {
  goal: string;
  business?: BusinessContext | null;
  plan: EnginePlan;
  maxPages?: number;
}): Promise<EngineRunResult> {
  const activity: string[] = [];
  const steps = params.plan.steps.map((s) => ({ ...s }));
  const maxPages = params.maxPages ?? 6;
  const sources: { title?: string; url: string }[] = [];
  const rows: ProspectRow[] = [];

  const mark = (index: number, status: EnginePlanStep["status"]) => {
    if (steps[index]) steps[index] = { ...steps[index], status };
  };

  try {
    // Step 0 — business context
    mark(0, "running");
    activity.push("Loaded business context");
    mark(0, "done");

    // Step 1 — web search
    mark(1, "running");
    activity.push(`Web search started: "${params.plan.researchQuery}"`);
    const search = await webSearch(params.plan.researchQuery || params.goal, 12);
    if (!search.ok) {
      mark(1, "failed");
      activity.push(`Web search failed: ${search.error}`);
      return {
        ok: false,
        activity,
        progress: 25,
        status: "failed",
        steps,
        error: search.error || "Search failed",
      };
    }

    const hits = ((search.data as any)?.hits || []) as SearchHit[];
    activity.push(`${hits.length} search results collected`);
    (search.sources || []).forEach((s) => sources.push(s));
    mark(1, "done");

    if (hits.length === 0) {
      mark(2, "skipped");
      mark(3, "skipped");
      mark(4, "done");
      const deliverable: EngineDeliverable = {
        type: "report",
        title: "Research results",
        content:
          "No public web results were found for this query. Try a more specific goal or different keywords.",
        rows: [],
        sources: [],
        createdAt: new Date().toISOString(),
      };
      activity.push("Mission completed with zero results");
      return {
        ok: true,
        activity,
        progress: 100,
        status: "completed",
        steps,
        deliverable,
      };
    }

    // Step 2 — read pages
    mark(2, "running");
    activity.push(`Reading up to ${Math.min(maxPages, hits.length)} pages`);
    let pagesRead = 0;
    for (const hit of hits.slice(0, maxPages)) {
      const page = await readWebPage(hit.url);
      if (!page.ok) {
        activity.push(`Could not read ${hit.url}: ${page.error}`);
        continue;
      }
      pagesRead++;
      const extract = page.data as {
        url: string;
        title: string;
        text: string;
      };
      sources.push({ title: extract.title, url: extract.url });

      const company =
        extract.title.split(/[\-|–|—|\|]/)[0].trim().slice(0, 80) || hit.title;
      const snippet =
        extract.text.slice(0, 220) || hit.snippet || "No extractable text";

      rows.push({
        company,
        website: extract.url,
        reason: "Matched search intent and had a reachable public page",
        evidence: snippet,
        source: extract.url,
      });
    }
    activity.push(`${pagesRead} websites analyzed`);
    mark(2, pagesRead > 0 ? "done" : "failed");

    if (pagesRead === 0) {
      mark(3, "failed");
      return {
        ok: false,
        activity,
        progress: 50,
        status: "failed",
        steps,
        error: "No pages could be read",
      };
    }

    // Step 3 — qualify (simple non-fabricated filter)
    mark(3, "running");
    const seen = new Set<string>();
    const qualified = rows.filter((r) => {
      const key = r.website.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return r.evidence.length > 40;
    });
    activity.push(`${qualified.length} items qualified from real page evidence`);
    mark(3, "done");

    // Step 4 — deliverable
    mark(4, "running");
    const lines = qualified.map(
      (r, i) =>
        `${i + 1}. ${r.company}\n   Website: ${r.website}\n   Why: ${r.reason}\n   Evidence: ${r.evidence}\n`
    );
    const content =
      `Research deliverable for: ${params.goal}\n\n` +
      `Found ${qualified.length} items with real page evidence.\n\n` +
      lines.join("\n");

    const deliverable: EngineDeliverable = {
      type: "lead_list",
      title: `Results: ${params.goal.slice(0, 60)}`,
      content,
      rows: qualified,
      sources: dedupeSources(sources),
      createdAt: new Date().toISOString(),
    };
    activity.push(`Final report created (${qualified.length} rows)`);
    mark(4, "done");

    return {
      ok: true,
      activity,
      progress: 100,
      status: "completed",
      steps,
      deliverable,
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

function dedupeSources(list: { title?: string; url: string }[]) {
  const seen = new Set<string>();
  return list.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
