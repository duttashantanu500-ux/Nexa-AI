/**
 * Deterministic workflow runner — connector actions only.
 * No web-search fallback. No fake external success.
 */

import { getAction } from "./actionRegistry";
import { generateWithComfy } from "./connectors/localComfy";
import type { WorkflowStep, WorkflowStepResult } from "@/types";

export interface WorkflowContext {
  list: string[];
  notes: string[];
  report: string;
  imageUrl?: string;
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

export interface RuntimeConnectionConfig {
  comfyBaseUrl?: string;
}

function emptyContext(): WorkflowContext {
  return { list: [], notes: [], report: "", vars: {}, sources: [] };
}

export async function runWorkflow(params: {
  steps: WorkflowStep[];
  simulate?: boolean;
  connections?: RuntimeConnectionConfig;
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
        error: "Unknown or unsupported action. Connect a provider that provides this action.",
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
        error: def.availabilityNote || "Action not available. Connect the required service in Connections.",
        simulated: simulate,
      });
      failed = true;
      break;
    }

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
      const detail = await executeAction(
        step.actionId,
        step.config,
        ctx,
        simulate,
        params.connections || {}
      );
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
    (ctx.imageUrl ? `Image: ${ctx.imageUrl}\n\n${ctx.notes.join("\n")}` : "") ||
    (ctx.list.length
      ? ctx.list.map((x, i) => `${i + 1}. ${x}`).join("\n")
      : results.map((r) => r.output || r.error || r.name).join("\n"));

  return {
    ok: !failed,
    status: failed
      ? results.some((r) => r.status === "succeeded")
        ? "partial"
        : "failed"
      : "completed",
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
  simulate: boolean,
  connections: RuntimeConnectionConfig
): Promise<string> {
  switch (actionId) {
    case "local_data.list_from_text": {
      const text = config.text || "";
      const sep = config.separator === "comma" ? "," : "\n";
      ctx.list = text
        .split(sep)
        .map((s) => s.trim())
        .filter(Boolean);
      return `List created with ${ctx.list.length} items`;
    }
    case "local_data.filter": {
      const kw = (config.keyword || "").toLowerCase();
      const mode = config.mode || "include";
      const before = ctx.list.length;
      ctx.list = ctx.list.filter((item) => {
        const hit = item.toLowerCase().includes(kw);
        return mode === "exclude" ? !hit : hit;
      });
      return `Filtered ${before} → ${ctx.list.length} items`;
    }
    case "local_data.limit": {
      const n = Math.max(1, parseInt(config.count || "10", 10) || 10);
      ctx.list = ctx.list.slice(0, n);
      return `Limited to ${ctx.list.length} items`;
    }
    case "local_data.template": {
      const tpl = config.template || "{{item}}";
      ctx.list = ctx.list.map((item) => tpl.replace(/\{\{\s*item\s*\}\}/gi, item));
      return `Formatted ${ctx.list.length} items`;
    }
    case "local_data.note": {
      ctx.notes.push(config.note || "");
      return "Note added";
    }
    case "local_data.report": {
      const title = config.title || "Report";
      const lines = [
        title,
        "=".repeat(Math.min(title.length, 40)),
        "",
        ...(ctx.notes.length ? ["Notes:", ...ctx.notes.map((n) => `- ${n}`), ""] : []),
        ...(ctx.imageUrl ? [`Image: ${ctx.imageUrl}`, ""] : []),
        ...(ctx.list.length
          ? ["Items:", ...ctx.list.map((x, i) => `${i + 1}. ${x}`)]
          : ["(No list items)"]),
      ];
      ctx.report = lines.join("\n");
      return ctx.report;
    }
    case "local_comfyui.test_connection": {
      if (simulate) return "[Simulated] Local engine reachable";
      const url = connections.comfyBaseUrl || "";
      if (!url) throw new Error("Set your ComfyUI endpoint in Connections first.");
      const { testComfyConnection } = await import("./connectors/localComfy");
      const r = await testComfyConnection(url);
      if (!r.ok) throw new Error(r.message);
      return r.message;
    }
    case "local_comfyui.generate_image": {
      if (simulate) {
        ctx.imageUrl = "[Simulated image — not a real file]";
        ctx.notes.push("[Simulated] Image generation skipped");
        return "[Simulated] Image would be generated locally";
      }
      const url = connections.comfyBaseUrl || "";
      if (!url) {
        throw new Error(
          "Local image engine is not configured. Open Connections and set your ComfyUI URL (e.g. http://127.0.0.1:8188)."
        );
      }
      const result = await generateWithComfy({
        baseUrl: url,
        prompt: config.prompt || "",
        negativePrompt: config.negative_prompt,
        width: parseInt(config.width || "512", 10) || 512,
        height: parseInt(config.height || "512", 10) || 512,
        seed: parseInt(config.seed || "-1", 10),
      });
      if (!result.ok || !result.imageUrl) {
        throw new Error(result.error || "Image generation failed");
      }
      ctx.imageUrl = result.imageUrl;
      ctx.sources.push({ title: "Generated image", url: result.imageUrl });
      ctx.notes.push(`Generated image: ${result.imageUrl}`);
      return `Image ready: ${result.imageUrl}`;
    }
    // Explicitly refuse legacy web / research actions
    case "web.search":
    case "web.read_page":
    case "data.list_from_text":
      throw new Error(
        "This action is not available. Nexa no longer defaults to web search or generic research."
      );
    default:
      throw new Error(
        `Action not available: ${actionId}. Connect the required service or choose a local action.`
      );
  }
}
