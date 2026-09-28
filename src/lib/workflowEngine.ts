/**
 * Deterministic workflow runner.
 */

import { getAction } from "./actionRegistry";
import { generateWithComfy } from "./connectors/localComfy";
import { slackListChannels, slackPostMessage } from "./connectors/providers/slack";
import {
  notionAppendBlocks,
  notionCreatePage,
  notionSearch,
} from "./connectors/providers/notion";
import { githubCreateIssue, githubListIssues } from "./connectors/providers/github";
import {
  bufferCreatePost,
  bufferListChannels,
  bufferListPosts,
} from "./connectors/providers/buffer";
import type { WorkflowStep, WorkflowStepResult } from "@/types";
import { resolveConfig } from "./mapping";
import { takeToken } from "./rateLimit";
import { redactStepResult } from "./redact";

export interface WorkflowContext {
  list: string[];
  notes: string[];
  report: string;
  imageUrl?: string;
  vars: Record<string, string>;
  sources: { title?: string; url: string }[];
  stepOutputs: Record<string, unknown>;
}

export interface WorkflowRunResult {
  ok: boolean;
  status:
    | "completed"
    | "failed"
    | "partial"
    | "succeeded_with_errors"
    | "waiting_for_approval";
  mode: "real" | "simulated";
  steps: WorkflowStepResult[];
  output: string;
  error?: string;
  context: WorkflowContext;
  pendingStepIndex?: number;
  pendingStepId?: string;
}

export interface RuntimeConnectionConfig {
  comfyBaseUrl?: string;
  slackToken?: string;
  notionToken?: string;
  githubToken?: string;
  userId?: string;
  notionDefaultParent?: string;
}

function emptyContext(): WorkflowContext {
  return { list: [], notes: [], report: "", vars: {}, sources: [], stepOutputs: {} };
}

export async function runWorkflow(params: {
  steps: WorkflowStep[];
  simulate?: boolean;
  connections?: RuntimeConnectionConfig;
  startIndex?: number;
  priorResults?: WorkflowStepResult[];
  priorContext?: Partial<WorkflowContext>;
  approvalGrantedForStepId?: string;
}): Promise<WorkflowRunResult> {
  const ctx: WorkflowContext = {
    ...emptyContext(),
    ...(params.priorContext || {}),
    list: params.priorContext?.list || [],
    notes: params.priorContext?.notes || [],
    vars: params.priorContext?.vars || {},
    sources: params.priorContext?.sources || [],
    stepOutputs: params.priorContext?.stepOutputs || {},
  };
  const results: WorkflowStepResult[] = [...(params.priorResults || [])];
  const simulate = Boolean(params.simulate);
  let hardFail = false;
  let softFail = false;
  let waitingApproval = false;
  let pendingStepIndex: number | undefined;
  let pendingStepId: string | undefined;

  const ordered = [...params.steps].sort((a, b) => a.order - b.order);
  const start = params.startIndex ?? 0;

  for (let i = start; i < ordered.length; i++) {
    if (hardFail || waitingApproval) break;
    const step = ordered[i];
    const def = getAction(step.actionId);
    const started = new Date().toISOString();
    const inputSent = { ...(step.config || {}) };
    const onError = step.onError || "stop";
    const maxAttempts =
      onError === "retry" ? Math.max(1, step.retryPolicy?.maxAttempts ?? 2) : 1;

    if (!def) {
      results.push(failResult(step, started, inputSent, "Unknown action.", simulate));
      if (onError === "continue") softFail = true;
      else hardFail = true;
      continue;
    }

    if (!def.implemented || !def.available) {
      results.push(
        failResult(
          step,
          started,
          inputSent,
          def.availabilityNote || "This action is not available yet.",
          simulate,
          { category: "not_configured" }
        )
      );
      if (onError === "continue") softFail = true;
      else hardFail = true;
      continue;
    }

    if (
      def.requiresApproval &&
      !simulate &&
      params.approvalGrantedForStepId !== step.id
    ) {
      waitingApproval = true;
      pendingStepIndex = i;
      pendingStepId = step.id;
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        status: "pending",
        startedAt: started,
        endedAt: new Date().toISOString(),
        inputSent,
        outputSummary: "Waiting for your approval before continuing.",
        simulated: false,
      });
      break;
    }

    let lastError = "";
    let succeeded = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) await sleep(step.retryPolicy?.backoffMs ?? 500);
      try {
        if (def.rateLimit) {
          const ok = takeToken(def.rateLimit.key, def.rateLimit.maxPerMinute);
          if (!ok) {
            lastError = "Too many requests. Please try again in a moment.";
            continue;
          }
        }
        const resolved = resolveConfig(step.config || {}, ctx);
        const out = await executeAction(
          step.actionId,
          resolved,
          ctx,
          simulate,
          params.connections || {}
        );
        if (out.ok) {
          results.push({
            stepId: step.id,
            actionId: step.actionId,
            status: "success",
            startedAt: started,
            endedAt: new Date().toISOString(),
            inputSent: redactStepResult(resolved as Record<string, unknown>) as Record<
              string,
              unknown
            >,
            outputSummary: out.message,
            outputData: out.data,
            simulated: simulate,
          });
          if (out.data !== undefined) {
            ctx.stepOutputs[step.id] = out.data;
          }
          succeeded = true;
          break;
        }
        lastError = out.message || "Step failed.";
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Step failed.";
      }
    }

    if (!succeeded) {
      results.push(
        failResult(step, started, inputSent, lastError || "Something went wrong.", simulate)
      );
      if (onError === "continue") softFail = true;
      else hardFail = true;
    }
  }

  const output =
    ctx.report ||
    (ctx.imageUrl ? `Image: ${ctx.imageUrl}\n\n${ctx.notes.join("\n")}` : "") ||
    (ctx.list.length
      ? ctx.list.map((x, i) => `${i + 1}. ${x}`).join("\n")
      : ctx.notes.join("\n"));

  let status: WorkflowRunResult["status"] = "completed";
  if (waitingApproval) status = "waiting_for_approval";
  else if (hardFail && !results.some((r) => r.status === "success")) status = "failed";
  else if (hardFail || softFail) status = "succeeded_with_errors";

  return {
    ok: !hardFail && !waitingApproval,
    status,
    mode: simulate ? "simulated" : "real",
    steps: results,
    output: String(redactStepResult({ output } as Record<string, unknown>).output || output),
    error: hardFail ? results.filter((r) => r.status === "failed").at(-1)?.outputSummary : undefined,
    context: ctx,
    pendingStepIndex,
    pendingStepId,
  };
}

function failResult(
  step: WorkflowStep,
  started: string,
  inputSent: Record<string, unknown>,
  error: string,
  simulate: boolean,
  errMeta?: { category?: string }
): WorkflowStepResult {
  return {
    stepId: step.id,
    actionId: step.actionId,
    status: "failed",
    startedAt: started,
    endedAt: new Date().toISOString(),
    inputSent,
    outputSummary: error,
    simulated: simulate,
    error: errMeta,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ActionExecResult = {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: { category?: string };
};

async function resolveSlackAccessToken(
  connections: RuntimeConnectionConfig
): Promise<string | undefined> {
  if (connections.slackToken) return connections.slackToken;
  if (connections.userId && typeof window === "undefined") {
    try {
      const { resolveSlackToken } = await import("./connectors/slackAuth");
      const resolved = await resolveSlackToken(connections.userId);
      return resolved?.token;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function resolveNotionAccessToken(
  connections: RuntimeConnectionConfig
): Promise<string | undefined> {
  if (connections.notionToken) return connections.notionToken;
  if (connections.userId && typeof window === "undefined") {
    try {
      const { resolveNotionToken } = await import("./connectors/notionAuth");
      const resolved = await resolveNotionToken(connections.userId);
      return resolved?.token;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function resolveBufferAccessToken(
  connections: RuntimeConnectionConfig
): Promise<string | undefined> {
  if (connections.userId && typeof window === "undefined") {
    try {
      const { resolveBufferToken } = await import("./connectors/bufferAuth");
      const resolved = await resolveBufferToken(connections.userId);
      return resolved?.token;
    } catch {
      return undefined;
    }
  }
  return undefined;
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
      ctx.list = text.split(sep).map((s) => s.trim()).filter(Boolean);
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
      return { ok: true, message: `Formatted ${ctx.list.length} items`, data: { list: ctx.list } };
    }
    case "local_data.note": {
      ctx.notes.push(config.note || "");
      return { ok: true, message: "Note added", data: { notes: ctx.notes } };
    }
    case "local_data.report": {
      const title = config.title || "Report";
      const lines = [
        title,
        "",
        ...(ctx.list.length ? ctx.list.map((x, i) => `${i + 1}. ${x}`) : []),
        ...(ctx.notes.length ? ["", "Notes:", ...ctx.notes] : []),
      ];
      ctx.report = lines.join("\n");
      return { ok: true, message: "Report ready", data: { report: ctx.report } };
    }
    case "local_comfyui.test_connection": {
      if (simulate) return { ok: true, message: "[Simulated] Connection OK" };
      const url = connections.comfyBaseUrl || "";
      if (!url)
        return {
          ok: false,
          message: "Set up the local image engine in Connections first.",
          error: { category: "validation" },
        };
      const { testComfyConnection } = await import("./connectors/localComfy");
      const r = await testComfyConnection(url);
      return r.ok
        ? { ok: true, message: r.message }
        : { ok: false, message: r.message, error: { category: "server_error" } };
    }
    case "local_comfyui.generate_image": {
      if (simulate) {
        ctx.imageUrl = "[Simulated image]";
        return { ok: true, message: "[Simulated] Image would be generated" };
      }
      const url = connections.comfyBaseUrl || "";
      if (!url)
        return {
          ok: false,
          message: "Local image engine is not set up yet.",
          error: { category: "validation" },
        };
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
          message: result.error || "Image could not be created.",
          error: { category: "server_error" },
        };
      }
      ctx.imageUrl = result.imageUrl;
      return { ok: true, message: `Image ready: ${result.imageUrl}`, data: { url: result.imageUrl } };
    }
    case "slack.post_message":
    case "slack.list_channels": {
      if (simulate) return { ok: true, message: `[Simulated] Would run ${actionId}` };
      if (typeof window !== "undefined" && connections.userId) {
        const res = await fetch("/api/connections/slack/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: connections.userId,
            actionId,
            input: config,
          }),
        });
        const data = await res.json().catch(() => ({}));
        return {
          ok: Boolean(data.ok),
          message: data.message || (data.ok ? "OK" : "Failed"),
          data: data.data,
          error: data.error,
        };
      }
      const token = await resolveSlackAccessToken(connections);
      if (!token) {
        return {
          ok: false,
          message: "Connect your Slack workspace under Connections first.",
          error: { category: "not_configured" },
        };
      }
      if (actionId === "slack.post_message") {
        const r = await slackPostMessage({
          accessToken: token,
          channel: config.channel || "",
          text: config.text || "",
        });
        return { ok: r.ok, message: r.message, data: r.data, error: r.error };
      }
      {
        const r = await slackListChannels({ accessToken: token });
        return { ok: r.ok, message: r.message, data: r.data, error: r.error };
      }
    }
    case "notion.create_page":
    case "notion.append_blocks":
    case "notion.search": {
      if (simulate) return { ok: true, message: `[Simulated] Would run ${actionId}` };
      if (typeof window !== "undefined" && connections.userId) {
        const res = await fetch("/api/connections/notion/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: connections.userId,
            actionId,
            input: config,
            defaultParent: connections.notionDefaultParent || "",
          }),
        });
        const data = await res.json().catch(() => ({}));
        return {
          ok: Boolean(data.ok),
          message: data.message || (data.ok ? "OK" : "Failed"),
          data: data.data,
          error: data.error,
        };
      }
      const notionToken = await resolveNotionAccessToken(connections);
      if (!notionToken) {
        return {
          ok: false,
          message: "Connect your Notion account under Connections first.",
          error: { category: "not_configured" },
        };
      }
      if (actionId === "notion.create_page") {
        const r = await notionCreatePage({
          accessToken: notionToken,
          parentId: config.parent_id || "",
          title: config.title || "",
          content: config.content,
        });
        return { ok: r.ok, message: r.message, data: r.data, error: r.error };
      }
      if (actionId === "notion.append_blocks") {
        const r = await notionAppendBlocks({
          accessToken: notionToken,
          pageId: config.page_id || "",
          content: config.content || "",
        });
        return { ok: r.ok, message: r.message, data: r.data, error: r.error };
      }
      {
        const r = await notionSearch({
          accessToken: notionToken,
          query: config.query || "",
        });
        return { ok: r.ok, message: r.message, data: r.data, error: r.error };
      }
    }
    case "buffer.list_channels":
    case "buffer.list_posts":
    case "buffer.create_post": {
      if (simulate) return { ok: true, message: `[Simulated] Would run ${actionId}` };
      if (typeof window !== "undefined" && connections.userId) {
        const res = await fetch("/api/connections/buffer/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: connections.userId,
            actionId,
            input: config,
          }),
        });
        const data = await res.json().catch(() => ({}));
        return {
          ok: Boolean(data.ok),
          message: data.message || (data.ok ? "OK" : "Failed"),
          data: data.data,
          error: data.error,
        };
      }
      const bufferToken = await resolveBufferAccessToken(connections);
      if (!bufferToken) {
        return {
          ok: false,
          message: "Connect your Buffer account under Connections first.",
          error: { category: "not_configured" },
        };
      }
      if (actionId === "buffer.create_post") {
        const r = await bufferCreatePost({
          accessToken: bufferToken,
          channel: config.channel || "",
          text: config.text || "",
          scheduledAt: config.scheduled_at || config.scheduledAt || "",
        });
        return { ok: r.ok, message: r.message, data: r.data, error: r.error };
      }
      if (actionId === "buffer.list_posts") {
        const r = await bufferListPosts({
          accessToken: bufferToken,
          channel: config.channel || "",
        });
        return { ok: r.ok, message: r.message, data: r.data, error: r.error };
      }
      {
        const r = await bufferListChannels({ accessToken: bufferToken });
        return { ok: r.ok, message: r.message, data: r.data, error: r.error };
      }
    }
    case "github.create_issue": {
      if (simulate) return { ok: true, message: "[Simulated] Would create issue" };
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
      if (simulate) return { ok: true, message: "[Simulated] Would list issues" };
      const r = await githubListIssues({
        accessToken: connections.githubToken,
        owner: config.owner || "",
        repo: config.repo || "",
      });
      return { ok: r.ok, message: r.message, data: r.data, error: r.error };
    }
    default:
      return {
        ok: false,
        message: "This action is not available.",
        error: { category: "validation" },
      };
  }
}
