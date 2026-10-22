/**
 * Deterministic workflow runner.
 * Browser: calls /api/connections/{provider}/execute with user JWT.
 * Server: executeServerAction for every connector (Notion, Slack, Buffer, HubSpot, Ideogram, Vapi, MCP).
 */

import { getAction } from "./actionRegistry";
import type { WorkflowStep, WorkflowStepResult, NormalizedProviderError } from "@/types";
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
  origin?: string;
  accessToken?: string;
}

function emptyContext(): WorkflowContext {
  return { list: [], notes: [], report: "", vars: {}, sources: [], stepOutputs: {} };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function mapNormError(err?: unknown): NormalizedProviderError | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { category?: string; providerStatusCode?: number; providerMessage?: string };
  const allowed = new Set([
    "auth",
    "rate_limit",
    "validation",
    "server_error",
    "unknown",
    "mapping_error",
    "not_configured",
  ]);
  const category = allowed.has(String(e.category || ""))
    ? (e.category as NormalizedProviderError["category"])
    : "unknown";
  return {
    category,
    providerStatusCode: e.providerStatusCode,
    providerMessage: e.providerMessage,
  };
}

function failResult(
  step: WorkflowStep,
  started: string,
  inputSent: Record<string, unknown>,
  error: string,
  simulate: boolean,
  errMeta?: NormalizedProviderError
): WorkflowStepResult {
  return {
    stepId: step.id,
    actionId: step.actionId,
    name: step.name,
    status: "failed",
    startedAt: started,
    endedAt: new Date().toISOString(),
    inputSent,
    output: error,
    error,
    normalizedError: errMeta,
    simulated: simulate,
  };
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
      (step.requiresApproval || def.requiresApproval) &&
      !simulate &&
      params.approvalGrantedForStepId !== step.id
    ) {
      waitingApproval = true;
      pendingStepIndex = i;
      pendingStepId = step.id;
      results.push({
        stepId: step.id,
        actionId: step.actionId,
        name: step.name,
        status: "awaiting_approval",
        startedAt: started,
        endedAt: new Date().toISOString(),
        inputSent,
        output: "Waiting for your approval before continuing.",
        simulated: false,
      });
      break;
    }

    let lastError = "";
    let lastNorm: NormalizedProviderError | undefined;
    let succeeded = false;
    const connectorId = def.connectionId || step.connectorId || "local_data";

    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      try {
        const rl = takeToken(connectorId);
        if (!rl.ok) {
          lastError = "Please wait a moment and try again.";
          lastNorm = { category: "rate_limit" };
          if (attempts < maxAttempts) await sleep(rl.retryAfterMs || 1000);
          continue;
        }
        const resolvedConfig = resolveConfig(
          step.config || {},
          step.inputMapping,
          ctx.stepOutputs
        );
        const detail = await executeAction(
          step.actionId,
          resolvedConfig,
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
            name: step.name,
            status: "succeeded",
            startedAt: started,
            endedAt: new Date().toISOString(),
            inputSent: redactStepResult(resolvedConfig as Record<string, unknown>) as Record<
              string,
              unknown
            >,
            output: detail.message,
            outputReceived: detail.data,
            simulated: simulate,
            retryCount: attempts - 1,
          });
          break;
        }
        lastError = detail.message || "Step failed.";
        lastNorm = detail.error;
        if (attempts < maxAttempts) await sleep(500);
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Step failed.";
        if (attempts < maxAttempts) await sleep(500);
      }
    }

    if (!succeeded) {
      results.push(
        failResult(
          step,
          started,
          inputSent,
          lastError || "Something went wrong.",
          simulate,
          lastNorm
        )
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
  else if (hardFail && !results.some((r) => r.status === "succeeded")) status = "failed";
  else if (hardFail || softFail) status = "succeeded_with_errors";

  return {
    ok: !hardFail && !waitingApproval,
    status,
    mode: simulate ? "simulated" : "real",
    steps: results,
    output: String(redactStepResult({ output } as Record<string, unknown>).output || output),
    error: hardFail ? results.filter((r) => r.status === "failed").at(-1)?.output : undefined,
    context: ctx,
    pendingStepIndex,
    pendingStepId,
  };
}

type ActionExecResult = {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: NormalizedProviderError;
};

async function browserAuthHeaders(): Promise<Record<string, string>> {
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { authHeaders } = await import("./authHeaders");
    headers = await authHeaders({ "Content-Type": "application/json" });
  } catch {
    /* */
  }
  return headers;
}

const PROVIDER_EXECUTE = [
  "slack",
  "notion",
  "buffer",
  "hubspot",
  "ideogram",
  "vapi",
  "mcp",
] as const;

async function executeProviderAction(
  actionId: string,
  config: Record<string, string>,
  connections: RuntimeConnectionConfig
): Promise<ActionExecResult> {
  const provider = actionId.split(".")[0];
  if (!PROVIDER_EXECUTE.includes(provider as (typeof PROVIDER_EXECUTE)[number])) {
    return {
      ok: false,
      message: "This action is not available.",
      error: { category: "validation" },
    };
  }

  // Browser: live session JWT → existing HTTP execute routes
  if (typeof window !== "undefined") {
    if (provider === "mcp") {
      const authHdr = await browserAuthHeaders();
      const toolName = (config.tool || config.toolName || "").trim();
      let args: Record<string, unknown> = {};
      try {
        if (config.args) args = JSON.parse(config.args);
      } catch {
        /* */
      }
      const res = await fetch("/api/connections/mcp/execute", {
        method: "POST",
        headers: authHdr,
        body: JSON.stringify({
          userId: connections.userId,
          toolName,
          args,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return {
        ok: Boolean(data.ok),
        message: data.message || (data.ok ? "Done" : "Tool failed"),
        data: data.data,
        error: data.ok ? undefined : { category: "unknown" },
      };
    }

    const authHdr = await browserAuthHeaders();
    const res = await fetch(`/api/connections/${provider}/execute`, {
      method: "POST",
      headers: authHdr,
      body: JSON.stringify({
        actionId,
        input: config,
        defaultParent: connections.notionDefaultParent,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: Boolean(data.ok),
      message: data.message || (data.ok ? "OK" : "Failed"),
      data: data.data,
      error: mapNormError(data.error),
    };
  }

  // Server with user JWT: optional self-call (same routes as browser)
  if (connections.accessToken && connections.origin && provider !== "mcp") {
    try {
      const res = await fetch(
        `${connections.origin.replace(/\/$/, "")}/api/connections/${provider}/execute`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${connections.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actionId,
            input: config,
            defaultParent: connections.notionDefaultParent,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      return {
        ok: Boolean(data.ok),
        message: data.message || (data.ok ? "OK" : "Failed"),
        data: data.data,
        error: mapNormError(data.error),
      };
    } catch {
      // fall through to direct server executor
    }
  }

  // Server (cron / background): all connectors via unified executor
  const userId = (connections.userId || "").trim();
  if (!userId) {
    return {
      ok: false,
      message: "Sign in required to run this action.",
      error: { category: "auth" },
    };
  }

  const { executeServerAction } = await import("./connectors/executeServerAction");
  return executeServerAction({
    userId,
    actionId,
    input: config,
    notionDefaultParent: connections.notionDefaultParent,
  });
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
    default: {
      if (simulate) return { ok: true, message: `Preview only — would run ${actionId}` };
      return executeProviderAction(actionId, config, connections);
    }
  }
}
