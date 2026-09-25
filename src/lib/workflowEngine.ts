/**
 * Deterministic workflow runner — no AI model required.
 */

import { getAction } from "./actionRegistry";
import type { WorkflowStep, WorkflowStepResult } from "@/types";

export interface WorkflowContext {
  list: string[];
  notes: string[];
  report: string;
  vars: Record<string, string>;
  sources: { title?: string; url: string }[];
}

export interface WorkflowRunResult {
  ok: boolean;
  status: "completed" | "failed" | "partial";
  mode: "real" | "simulated";
  steps: WorkflowStepResult[];
  output: string;
  error?: string;
  context: WorkflowContext;
}

function emptyContext(): WorkflowContext {
  return { list: [], notes: [], report: "", vars: {}, sources: [] };
}

export async function runWorkflow(params: {
  steps: WorkflowStep[];
  simulate?: boolean;
}): Promise<WorkflowRunResult> {
  const ctx = emptyContext();
  const results: WorkflowStepResult[] = [];
  const simulate = Boolean(params.simulate);
  let failed = false;

  const ordered = [...params.steps].sort((a, b) => a.order - b.order);

  for (const step of ordered) {
    const def = getAction(step.actionId);
    const started = new Date().toISOString();

    if (!def) {
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        name: step.name || step.actionId,
        status: "failed",
        startedAt: started,
        endedAt: new Date().toISOString(),
        error: "Unknown action",
        simulated: simulate,
      });
      failed = true;
      break;
    }

    if (!def.available) {
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        name: def.name,
        status: "failed",
        startedAt: started,
        endedAt: new Date().toISOString(),
        error: def.availabilityNote || "Action not available",
        simulated: simulate,
      });
      failed = true;
      break;
    }

    // Validate required fields
    for (const f of def.fields) {
      if (f.required && !String(step.config[f.key] ?? "").trim()) {
        results.push({
          stepId: step.id,
          actionId: step.actionId,
          name: def.name,
          status: "failed",
          startedAt: started,
          endedAt: new Date().toISOString(),
          error: `Missing required field: ${f.label}`,
          simulated: simulate,
        });
        failed = true;
        break;
      }
    }
    if (failed) break;

    try {
      const detail = await executeAction(step.actionId, step.config, ctx, simulate);
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        name: def.name,
        status: "succeeded",
        startedAt: started,
        endedAt: new Date().toISOString(),
        output: detail,
        simulated: simulate || detail.startsWith("[Simulated]"),
      });
    } catch (err: any) {
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        name: def.name,
        status: "failed",
        startedAt: started,
        endedAt: new Date().toISOString(),
        error: err?.message || "Step failed",
        simulated: simulate,
      });
      failed = true;
      break;
    }
  }

  const output =
    ctx.report ||
    (ctx.list.length
      ? ctx.list.map((x, i) => `${i + 1}. ${x}`).join("\n")
      : results.map((r) => r.output || r.error || r.name).join("\n"));

  return {
    ok: !failed,
    status: failed ? (results.some((r) => r.status === "succeeded") ? "partial" : "failed") : "completed",
    mode: simulate || results.some((r) => r.simulated) ? "simulated" : "real",
    steps: results,
    output,
    error: failed ? results.find((r) => r.status === "failed")?.error : undefined,
    context: ctx,
  };
}

async function executeAction(
  actionId: string,
  config: Record<string, string>,
  ctx: WorkflowContext,
  simulate: boolean
): Promise<string> {
  switch (actionId) {
    case "data.list_from_text": {
      const text = config.text || "";
      const sep = config.separator === "comma" ? "," : "\n";
      ctx.list = text
        .split(sep)
        .map((s) => s.trim())
        .filter(Boolean);
      return `List created with ${ctx.list.length} items`;
    }
    case "data.filter": {
      const kw = (config.keyword || "").toLowerCase();
      const mode = config.mode || "include";
      const before = ctx.list.length;
      ctx.list = ctx.list.filter((item) => {
        const hit = item.toLowerCase().includes(kw);
        return mode === "exclude" ? !hit : hit;
      });
      return `Filtered ${before} → ${ctx.list.length} items (keyword: "${config.keyword}")`;
    }
    case "data.limit": {
      const n = Math.max(1, parseInt(config.count || "10", 10) || 10);
      ctx.list = ctx.list.slice(0, n);
      return `Limited to ${ctx.list.length} items`;
    }
    case "data.template": {
      const tpl = config.template || "{{item}}";
      ctx.list = ctx.list.map((item) => tpl.replace(/\{\{\s*item\s*\}\}/gi, item));
      return `Formatted ${ctx.list.length} items`;
    }
    case "logic.note": {
      ctx.notes.push(config.note || "");
      return "Note added";
    }
    case "output.report": {
      const title = config.title || "Report";
      const lines = [
        title,
        "=".repeat(Math.min(title.length, 40)),
        "",
        ...(ctx.notes.length ? ["Notes:", ...ctx.notes.map((n) => `- ${n}`), ""] : []),
        ...(ctx.list.length
          ? ["Items:", ...ctx.list.map((x, i) => `${i + 1}. ${x}`)]
          : ["(No list items)"]),
        ...(ctx.sources.length
          ? ["", "Sources:", ...ctx.sources.map((s) => `- ${s.title || s.url}: ${s.url}`)]
          : []),
      ];
      ctx.report = lines.join("\n");
      return ctx.report;
    }
    case "web.search": {
      if (simulate) {
        ctx.list = [
          `[Simulated] Result for "${config.query}" #1`,
          `[Simulated] Result for "${config.query}" #2`,
          `[Simulated] Result for "${config.query}" #3`,
        ];
        return `[Simulated] 3 search results for "${config.query}"`;
      }
      const max = Math.min(parseInt(config.maxResults || "8", 10) || 8, 15);
      const res = await fetch("/api/tools/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: config.query, maxResults: max }),
      });
      const data = await res.json();
      const hits = (data?.data?.hits || []) as {
        title: string;
        url: string;
        snippet?: string;
      }[];
      if (!hits.length) {
        return `No search results for "${config.query}"`;
      }
      ctx.list = hits.map(
        (h) => `${h.title}${h.snippet ? ` — ${h.snippet.slice(0, 120)}` : ""} (${h.url})`
      );
      hits.forEach((h) => ctx.sources.push({ title: h.title, url: h.url }));
      return `Found ${hits.length} results`;
    }
    case "web.read_page": {
      if (simulate) {
        return `[Simulated] Page content from ${config.url}`;
      }
      const res = await fetch(config.url, {
        signal: AbortSignal.timeout(12000),
      }).catch(() => null);
      if (!res || !res.ok) throw new Error(`Could not read page (${res?.status || "network"})`);
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000);
      ctx.notes.push(`Page ${config.url}: ${text.slice(0, 400)}`);
      ctx.sources.push({ url: config.url });
      return `Read ${text.length} characters from page`;
    }
    default:
      throw new Error(`Action not implemented: ${actionId}`);
  }
}
