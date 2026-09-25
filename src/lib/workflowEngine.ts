/**
 * Deterministic workflow runner — connector actions only.
 * Lifecycle: stop / continue / retry per step; never fake provider success.
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
  /** Last outputs keyed by step id for future mapping */
  stepOutputs: Record<string, unknown>;
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
  slackToken?: string;
  notionToken?: string;
  githubToken?: string;
}

function emptyContext(): WorkflowContext {
  return { list: [], notes: [], report: "", vars: {}, sources: [], stepOutputs: {} };
}

export async function runWorkflow(params: {
  steps: WorkflowStep[];
  simulate?: boolean;
  connections?: RuntimeConnectionConfig;
}): Promise<WorkflowRunResult> {
  const ctx = emptyContext();
  const results: WorkflowStepResult[] = [];
  const simulate = Boolean(params.simulate);
  let hardFail = false;
  let softFail = false;
  const ordered = [...params.steps].sort((a, b) => a.order - b.order);

  for (const step of ordered) {
    if (hardFail) break;

    const def = getAction(step.actionId);
    const started = new Date().toISOString();
    const inputSent = { ...(step.config || {}) };
    const onError = step.onError || "stop";
    const maxAttempts =
      onError === "retry"
        ? Math.max(1, step.retryPolicy?.maxAttempts ?? 2)
        : 1;

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
        retryCount: 0,
        simulated: simulate,
      });
      if (onError === "continue") softFail = true;
      else hardFail = true;
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
          "Action is not implemented. Connect the service first.",
        normalizedError: { category: "not_configured" },
        retryCount: 0,
        simulated: simulate,
      });
      if (onError === "continue") softFail = true;
      else hardFail = true;
      continue;
    }

    let missing = false;
    for (const f of def.fields) {
      if (f.required && !String(step.config?.[f.key] ?? "").trim()) {
        results.push({
          stepId: step.id,
          actionId: step.actionId,
          name: def.name,
          status: "failed",
          startedAt: started,
          endedAt: new Date().toISOString(),
          inputSent,
          error: `Missing required field: ${f.label}`,
          normalizedError: { category: "validation" },
          retryCount: 0,
          simulated: simulate,
        });
        missing = true;
        break;
      }
    }
    if (missing) {
      if (onError === "continue") softFail = true;
      else hardFail = true;
      continue;
    }

    let lastError = "";
    let lastData: unknown;
    let lastNorm: WorkflowStepResult["normalizedError"];
    let succeeded = false;
    let attempts = 0;

    while (attempts < maxAttempts && !succeeded) {
      attempts += 1;
      try {
        const detail = await executeAction(
          step.actionId,
          step.config || {},
          ctx,
          simulate,
          params.connections || {}
        );
        if (detail.ok) {
          succeeded = true;
          const key = step.outputKey || step.id;
          ctx.stepOutputs[key] = detail.data ?? detail.message;
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
            retryCount: attempts - 1,
            simulated: simulate || detail.message.startsWith("[Simulated]"),
          });
        } else {
          lastError = detail.message;
          lastData = detail.data;
          lastNorm = detail.error;
          if (attempts < maxAttempts) {
            const backoff = (step.retryPolicy?.backoffSeconds ?? 1) * attempts;
            await sleep(Math.min(backoff, 5) * 1000);
          }
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : "Step failed";
        lastNorm = { category: "unknown" };
      }
    }

    if (!succeeded) {
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        name: def.name,
        status: "failed",
        startedAt: started,
        endedAt: new Date().toISOString(),
        inputSent,
        outputReceived: lastData,
        error: lastError || "Step failed",
        normalizedError: lastNorm,
        retryCount: attempts - 1,
        simulated: simulate,
      });
      if (onError === "continue") softFail = true;
      else hardFail = true;
    }
  }

  const output =
    ctx.report ||
    (ctx.imageUrl ? `Image: ${ctx.imageUrl}\n\n${ctx.notes.join("\n")}` : "") ||
    (ctx.list.length
      ? ctx.list.map((x, i) => `${i + 1}. ${x}`).join("\n")
      : results.map((r) => r.output || r.error || r.name).join("\n"));

  const hadSuccess = results.some((r) => r.status === "succeeded");
  let status: WorkflowRunResult["status"] = "completed";
  if (hardFail && !hadSuccess) status = "failed";
  else if (hardFail || softFail) status = "succeeded_with_errors";

  return {
    ok: !hardFail && !softFail,
    status,
    mode: simulate || results.some((r) => r.simulated) ? "simulated" : "real",
    steps: results,
    output,
    error:
      hardFail || softFail
        ? results.find((r) => r.status === "failed")?.error
        : undefined,
    context: ctx,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
      return {
        ok: true,
        message: `List created with ${ctx.list.length} items`,
        data: { count: ctx.list.length, list: ctx.list },
      };
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
        data: { before, after: ctx.list.length, list: ctx.list },
      };
    }
    case "local_data.limit": {
      const n = Math.max(1, parseInt(config.count || "10", 10) || 10);
      ctx.list = ctx.list.slice(0, n);
      return {
        ok: true,
        message: `Limited to ${ctx.list.length} items`,
        data: { count: ctx.list.length, list: ctx.list },
      };
    }
    case "local_data.template": {
      const tpl = config.template || "{{item}}";
      ctx.list = ctx.list.map((item) => tpl.replace(/\{\{\s*item\s*\}\}/gi, item));
      return {
        ok: true,
        message: `Formatted ${ctx.list.length} items`,
        data: { list: ctx.list },
      };
    }
    case "local_data.note": {
      ctx.notes.push(config.note || "");
      return { ok: true, message: "Note added", data: { notes: ctx.notes } };
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
      return { ok: true, message: ctx.report, data: { title, report: ctx.report } };
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
          message: "Local image engine is not configured.",
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
      return {
        ok: true,
        message: `Image ready: ${result.imageUrl}`,
        data: { url: result.imageUrl },
      };
    }
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
