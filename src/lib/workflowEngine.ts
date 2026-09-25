/**
 * Deterministic workflow runner — connector actions only.
 * No web-search fallback. No fake external success.
 * External providers only succeed when the provider returns success.
 */

import { getAction } from "./actionRegistry";
import { generateWithComfy } from "./connectors/localComfy";
import { slackListChannels, slackPostMessage } from "./connectors/providers/slack";
import { notionCreatePage } from "./connectors/providers/notion";
import { githubCreateIssue, githubListIssues } from "./connectors/providers/github";
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
  status: "completed" | "failed" | "partial" | "succeeded_with_errors";
  mode: "real" | "simulated";
  steps: WorkflowStepResult[];
  output: string;
  error?: string;
  context: WorkflowContext;
}

export interface RuntimeConnectionConfig {
  comfyBaseUrl?: string;
  /** Server-side only when available — never put real tokens in the browser long-term */
  slackToken?: string;
  notionToken?: string;
  githubToken?: string;
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
  let hadSuccess = false;
  const ordered = [...params.steps].sort((a, b) => a.order - b.order);
  const onErrorContinue = false; // Phase 3+ will honor step.onError

  for (const step of ordered) {
    const def = getAction(step.actionId);
    const started = new Date().toISOString();
    const inputSent = { ...step.config };

    if (!def) {
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        name: step.name || step.actionId,
        status: "failed",
        startedAt: started,
        endedAt: new Date().toISOString(),
        inputSent,
        error: "Unknown action.",
        simulated: simulate,
      });
      failed = true;
      if (!onErrorContinue) break;
      continue;
    }

    if (!def.implemented || !def.available) {
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        name: def.name,
        status: "failed",
        startedAt: started,
        endedAt: new Date().toISOString(),
        inputSent,
        error:
          def.availabilityNote ||
          "Action is not implemented. Connect the service and wait until the action is marked implemented.",
        normalizedError: { category: "validation" },
        simulated: simulate,
      });
      failed = true;
      if (!onErrorContinue) break;
      continue;
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
          inputSent,
          error: `Missing required field: ${f.label}`,
          simulated: simulate,
        });
        failed = true;
        break;
      }
    }
    if (failed && !onErrorContinue) break;
    if (failed) continue;

    try {
      const detail = await executeAction(
        step.actionId,
        step.config,
        ctx,
        simulate,
        params.connections || {}
      );

      if (!detail.ok) {
        results.push({
          stepId: step.id,
          actionId: step.actionId,
          name: def.name,
          status: "failed",
          startedAt: started,
          endedAt: new Date().toISOString(),
          inputSent,
          outputReceived: detail.data,
          error: detail.message,
          normalizedError: detail.error,
          simulated: simulate,
        });
        failed = true;
        if (!onErrorContinue) break;
        continue;
      }

      hadSuccess = true;
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        name: def.name,
        status: "succeeded",
        startedAt: started,
        endedAt: new Date().toISOString(),
        inputSent,
        outputReceived: detail.data,
        output: detail.message,
        simulated: simulate || detail.message.startsWith("[Simulated]"),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Step failed";
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        name: def.name,
        status: "failed",
        startedAt: started,
        endedAt: new Date().toISOString(),
        inputSent,
        error: message,
        simulated: simulate,
      });
      failed = true;
      if (!onErrorContinue) break;
    }
  }

  const output =
    ctx.report ||
    (ctx.imageUrl ? `Image: ${ctx.imageUrl}\n\n${ctx.notes.join("\n")}` : "") ||
    (ctx.list.length
      ? ctx.list.map((x, i) => `${i + 1}. ${x}`).join("\n")
      : results.map((r) => r.output || r.error || r.name).join("\n"));

  let status: WorkflowRunResult["status"] = "completed";
  if (failed && hadSuccess) status = "partial";
  else if (failed) status = "failed";

  return {
    ok: !failed,
    status,
    mode: simulate || results.some((r) => r.simulated) ? "simulated" : "real",
    steps: results,
    output,
    error: failed ? results.find((r) => r.status === "failed")?.error : undefined,
    context: ctx,
  };
}

interface ActionExecResult {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: WorkflowStepResult["normalizedError"];
}

async function executeAction(
  actionId: string,
  config: Record<string, string>,
  ctx: WorkflowContext,
  simulate: boolean,
  connections: RuntimeConnectionConfig
): Promise<ActionExecResult> {
  switch (actionId) {
    case "local_data.list_from_text": {
      const text = config.text || "";
      const sep = config.separator === "comma" ? "," : "\n";
      ctx.list = text
        .split(sep)
        .map((s) => s.trim())
        .filter(Boolean);
      return { ok: true, message: `List created with ${ctx.list.length} items`, data: { count: ctx.list.length } };
    }
    case "local_data.filter": {
      const kw = (config.keyword || "").toLowerCase();
      const mode = config.mode || "include";
      const before = ctx.list.length;
      ctx.list = ctx.list.filter((item) => {
        const hit = item.toLowerCase().includes(kw);
        return mode === "exclude" ? !hit : hit;
      });
      return {
        ok: true,
        message: `Filtered ${before} → ${ctx.list.length} items`,
        data: { before, after: ctx.list.length },
      };
    }
    case "local_data.limit": {
      const n = Math.max(1, parseInt(config.count || "10", 10) || 10);
      ctx.list = ctx.list.slice(0, n);
      return { ok: true, message: `Limited to ${ctx.list.length} items`, data: { count: ctx.list.length } };
    }
    case "local_data.template": {
      const tpl = config.template || "{{item}}";
      ctx.list = ctx.list.map((item) => tpl.replace(/\{\{\s*item\s*\}\}/gi, item));
      return { ok: true, message: `Formatted ${ctx.list.length} items` };
    }
    case "local_data.note": {
      ctx.notes.push(config.note || "");
      return { ok: true, message: "Note added" };
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
      return { ok: true, message: ctx.report, data: { title } };
    }
    case "local_comfyui.test_connection": {
      if (simulate) return { ok: true, message: "[Simulated] Local engine reachable" };
      const url = connections.comfyBaseUrl || "";
      if (!url) {
        return {
          ok: false,
          message: "Set your ComfyUI endpoint in Connections first.",
          error: { category: "validation" },
        };
      }
      const { testComfyConnection } = await import("./connectors/localComfy");
      const r = await testComfyConnection(url);
      return r.ok
        ? { ok: true, message: r.message }
        : { ok: false, message: r.message, error: { category: "server_error" } };
    }
    case "local_comfyui.generate_image": {
      if (simulate) {
        ctx.imageUrl = "[Simulated image — not a real file]";
        return { ok: true, message: "[Simulated] Image would be generated locally" };
      }
      const url = connections.comfyBaseUrl || "";
      if (!url) {
        return {
          ok: false,
          message:
            "Local image engine is not configured. Open Connections and set your ComfyUI URL.",
          error: { category: "validation" },
        };
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
        return {
          ok: false,
          message: result.error || "Image generation failed",
          error: { category: "server_error" },
        };
      }
      ctx.imageUrl = result.imageUrl;
      ctx.sources.push({ title: "Generated image", url: result.imageUrl });
      return { ok: true, message: `Image ready: ${result.imageUrl}`, data: { url: result.imageUrl } };
    }

    // External providers — require token; never mark implemented in registry until OAuth+token path is verified
    case "slack.post_message": {
      if (simulate) return { ok: true, message: "[Simulated] Would post Slack message" };
      const r = await slackPostMessage({
        accessToken: connections.slackToken,
        channel: config.channel || "",
        text: config.text || "",
      });
      return { ok: r.ok, message: r.message, data: r.data, error: r.error };
    }
    case "slack.list_channels": {
      if (simulate) return { ok: true, message: "[Simulated] Would list Slack channels" };
      const r = await slackListChannels({ accessToken: connections.slackToken });
      return { ok: r.ok, message: r.message, data: r.data, error: r.error };
    }
    case "notion.create_page": {
      if (simulate) return { ok: true, message: "[Simulated] Would create Notion page" };
      const r = await notionCreatePage({
        accessToken: connections.notionToken,
        parentId: config.parent_id || "",
        title: config.title || "",
        content: config.content,
      });
      return { ok: r.ok, message: r.message, data: r.data, error: r.error };
    }
    case "github.create_issue": {
      if (simulate) return { ok: true, message: "[Simulated] Would create GitHub issue" };
      const r = await githubCreateIssue({
        accessToken: connections.githubToken,
        owner: config.owner || "",
        repo: config.repo || "",
        title: config.title || "",
        body: config.body,
      });
      return { ok: r.ok, message: r.message, data: r.data, error: r.error };
    }
    case "github.list_issues": {
      if (simulate) return { ok: true, message: "[Simulated] Would list GitHub issues" };
      const r = await githubListIssues({
        accessToken: connections.githubToken,
        owner: config.owner || "",
        repo: config.repo || "",
      });
      return { ok: r.ok, message: r.message, data: r.data, error: r.error };
    }

    case "web.search":
    case "web.read_page":
      return {
        ok: false,
        message: "Web search is not available as a workflow action.",
        error: { category: "validation" },
      };

    default:
      return {
        ok: false,
        message: `Action not available: ${actionId}`,
        error: { category: "validation" },
      };
  }
}
