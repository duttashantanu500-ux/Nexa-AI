/**
 * AI Employee Builder LLM call — multi-provider with local fallback.
 * Supports create (new hire) and edit (existing employee) modes.
 * Product loop: connect apps → hire AI employee → run work → Work Board results.
 */
import { registryCatalogForPrompt } from "./validate";
import { callOpenAICompat, callGemini, callOllama } from "./modelClients";
import {
  formatLiveOptionsForPrompt,
  type LiveAccountOptions,
} from "./liveAccountOptions";

const OFF_TOPIC_CREATE =
  "I hire and shape AI employees for real work on your connected apps.\n\n" +
  "Describe a role, for example:\n" +
  "• Research assistant that saves notes to Notion\n" +
  "• Inbox helper that checks Gmail\n" +
  "• Ops employee that posts updates to Slack\n\n" +
  "What should this employee own?";

const OFF_TOPIC_EDIT =
  "I update this AI employee — schedule, apps, steps, or purpose.\n\n" +
  "Try:\n" +
  "• Run every weekday at 9 AM\n" +
  "• Add a Slack update step\n" +
  "• Change the Notion destination\n\n" +
  "What should change?";

function getApiKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = process.env[name];
    if (raw && raw.trim()) return raw.trim();
  }
  return null;
}

function connectionSummary(
  connections?: Record<string, string>,
  liveOptions?: LiveAccountOptions
): string {
  if (!connections || !Object.keys(connections).length) {
    return "No connected apps detected yet. Still propose the employee; mark apps that need connecting.";
  }
  const lines = Object.entries(connections).map(([id, status]) => `- ${id}: ${status}`);
  const live = liveOptions ? "\n\n" + formatLiveOptionsForPrompt(liveOptions) : "";
  return `Live connection status:\n${lines.join("\n")}\nIf not connected, Status must be Connection required. When a connector IS connected, do NOT ask the user to "set a default page" as a blocker — instead use LIVE ACCOUNT TARGETS below (or ask them to pick one by name) and use the page or channel the user picks.${live}`;
}

function existingAgentSummary(existing?: {
  name?: string;
  purpose?: string;
  description?: string;
  steps?: { actionId?: string; name?: string; config?: Record<string, unknown> }[];
  schedule?: { frequency?: string; time?: string; timezone?: string; enabled?: boolean };
}): string {
  if (!existing) return "";
  const steps = Array.isArray(existing.steps) ? existing.steps : [];
  const stepLines = steps
    .map((s, i) => `  ${i + 1}. ${s?.name || s?.actionId || "step"} (${s?.actionId || "?"})`)
    .join("\n");
  const sched = existing.schedule;
  return `
CURRENT EMPLOYEE (edit this — do not invent a brand-new hire):
- Name: ${existing.name || "(unnamed)"}
- Purpose: ${existing.purpose || existing.description || ""}
- Schedule: ${sched?.frequency || "once"} ${sched?.time || ""} ${sched?.timezone || "UTC"} enabled=${Boolean(sched?.enabled)}
- Steps:
steps || "  (none)"}

You are refining THIS employee. Intent must be "update". Keep their identity unless the user asks to rename. Only change what they asked for.`;
}

function buildSystemPrompt(
  connections?: Record<string, string>,
  mode: "create" | "edit" = "create",
  existing?: {
    name?: string;
    purpose?: string;
    description?: string;
    steps?: { actionId?: string; name?: string; config?: Record<string, unknown> }[];
    schedule?: { frequency?: string; time?: string; timezone?: string; enabled?: boolean };
  },
  liveOptions?: LiveAccountOptions
): string {
  const connBlock = connectionSummary(connections, liveOptions);
  if (mode === "edit") {
    return `You are Nexa employee editor for one EXISTING AI employee. Not a general chatbot. Not the new-hire desk.\n${existingAgentSummary(existing)}\n\nRegistry (only these actions):\n${registryCatalogForPrompt()}\n\n${connBlock}\n\nRespond with ONLY valid JSON:\n{"off_topic":false,"intent":"update","message":"short note about what you changed","proposal":{"name":"string","description":"string","purpose":"string","trigger":"manual|schedule","schedule":{"frequency":"once|daily|weekly|monthly","time":"HH:MM","timezone":"UTC","enabled":true},"steps":[{"actionId":"from_registry","name":"label","config":{},"onError":"stop","requiresApproval":false}],"notes":""}}\n\nRules: preserve steps the user did not ask to change; fewest changes; prefer registry actions for connected apps (Slack, Notion, Gmail, GitHub, etc.).\nWhen the user names a page/channel, map it to LIVE ACCOUNT TARGETS. Never invent targets or claim work already ran.\nIf the user only greets, respond with {"off_topic":true,"message":"warm redirect toward changing schedule, apps, or steps"}. You edit this employee only.`;
  }

  return `You are Nexa Hiring Desk. You design one AI employee at a time for a digital workforce product.\nUsers connect apps, hire employees with real steps, run work, and review outcomes on the Work Board.\nPropose one AI employee using only this registry:\n\n${registryCatalogForPrompt()}\n\n${connBlock}\n\nRespond with ONLY valid JSON:\n{"off_topic":false,"intent":"create","message":"short note","proposal":{"name":"string","description":"string","purpose":"string","trigger":"manual|schedule","schedule":{"frequency":"once|daily|weekly|monthly","time":"HH:MM","timezone":"UTC","enabled":true},"steps":[{"actionId":"from_registry","name":"label","config":{},"onError":"stop","requiresApproval":false}],"notes":""}}\n\nProduct loop: connect apps → hire AI employee with clear steps → user starts work → results appear on Work Board.\nRules: fewest steps; use registry actions only; Slack=slack.*; Notion=notion.*; local notes=local_data.*; custom=mcp.call_tool when needed.\nIf an app is not connected: still propose the employee and mark connection required. When connected, use LIVE ACCOUNT TARGETS — never invent page/channel IDs.\nNever claim work already ran. Schedules: once/daily/weekly/monthly only.\nGreetings or off-topic → {"off_topic":true,"message":"redirect to describing a role"}. Never invent a fake employee for small talk.\nSpeak to the user in plain language. Prefer "AI employee" over "agent". Never mention internal providers or model names.`;
}

export type BuilderCompleteResult =
  | { kind: "off_topic"; message: string; thinking?: string[] }
  | { kind: "proposal"; message: string; proposal: unknown; provider?: string; thinking?: string[] }
  | { kind: "error"; message: string; thinking?: string[] };

export async function completeAgentBuilder(params: {
  messages: { role: "user" | "assistant"; content: string }[];
  connections?: Record<string, string>;
  mode?: "create" | "edit";
  existingAgent?: {
    name?: string;
    purpose?: string;
    description?: string;
    steps?: { actionId?: string; name?: string; config?: Record<string, unknown> }[];
    schedule?: { frequency?: string; time?: string; timezone?: string; enabled?: boolean };
  };
  liveOptions?: LiveAccountOptions;
}): Promise<BuilderCompleteResult> {
  const mode = params.mode === "edit" ? "edit" : "create";
  const OFF_TOPIC = mode === "edit" ? OFF_TOPIC_EDIT : OFF_TOPIC_CREATE;
  const thinking: string[] = [];
  thinking.push(mode === "edit" ? "Reading change request for this employee" : "Reading your request");
  thinking.push("Checking available connectors and actions");
  if (params.liveOptions) {
    thinking.push("Loading targets from your connected accounts");
  }

  const system = buildSystemPrompt(
    params.connections,
    mode,
    params.existingAgent,
    params.liveOptions
  );
  const all = params.messages || [];
  const recent = all.slice(-6);
  const textMessages = [
    { role: "system" as const, content: system },
    ...recent.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const lastUser = [...params.messages].reverse().find((m) => m.role === "user");
  if (lastUser && looksOffTopic(lastUser.content, mode)) {
    thinking.push("Request is outside AI Employee Builder scope");
    return { kind: "off_topic", message: OFF_TOPIC, thinking };
  }

  thinking.push(mode === "edit" ? "Updating workflow from the registry" : "Designing a workflow from the registry");

  const geminiKey = getApiKey("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY");
  const groqKey = getApiKey("GROQ_API_KEY");
  const deepseekKey = getApiKey("DEEPSEEK_API_KEY");
  const openrouterKey = getApiKey("OPENROUTER_API_KEY");
  const openaiKey = getApiKey("OPENAI_API_KEY");
  const ollamaKey = getApiKey("OLLAMA_API_KEY");
  const ollamaBase = (
    process.env.OLLAMA_API_BASE ||
    process.env.OLLAMA_HOST ||
    "https://ollama.com/api"
  ).replace(/\/$/, "");
  const ollamaModels = (
    process.env.OLLAMA_MODEL ||
    "gpt-oss:20b,gemma4:31b"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  type Attempt = () => Promise<{ text: string; provider: string } | null>;
  const attempts: Attempt[] = [];

  if (ollamaKey) {
    for (const model of ollamaModels) {
      attempts.push(async () => {
        const text = await callOllama({
          baseUrl: ollamaBase,
          model,
          apiKey: ollamaKey,
          messages: textMessages,
          jsonFormat: true,
        });
        return text ? { text, provider: `ollama:${model}` } : null;
      });
    }
  }

  if (groqKey) {
    for (const model of ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]) {
      attempts.push(async () => {
        const text = await callOpenAICompat({
          baseUrl: "https://api.groq.com/openai/v1",
          model,
          apiKey: groqKey,
          messages: textMessages,
          jsonMode: true,
        });
        return text ? { text, provider: `groq:${model}` } : null;
      });
    }
  }
  if (geminiKey) {
    for (const model of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"]) {
      attempts.push(async () => {
        const text = await callGemini({
          apiKey: geminiKey,
          model,
          system,
          messages: recent,
        });
        return text ? { text, provider: `gemini:${model}` } : null;
      });
    }
  }
  if (deepseekKey) {
    attempts.push(async () => {
      const text = await callOpenAICompat({
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat",
        apiKey: deepseekKey,
        messages: textMessages,
        jsonMode: true,
      });
      return text ? { text, provider: "deepseek" } : null;
    });
  }
  if (openaiKey) {
    for (const model of ["gpt-4o-mini", "gpt-4o"]) {
      attempts.push(async () => {
        const text = await callOpenAICompat({
          baseUrl: "https://api.openai.com/v1",
          model,
          apiKey: openaiKey,
          messages: textMessages,
          jsonMode: true,
        });
        return text ? { text, provider: `openai:${model}` } : null;
      });
    }
  }
  if (openrouterKey) {
    for (const model of ["deepseek/deepseek-chat-v3-0324", "google/gemini-2.5-flash"]) {
      attempts.push(async () => {
        const text = await callOpenAICompat({
          baseUrl: "https://openrouter.ai/api/v1",
          model,
          apiKey: openrouterKey,
          messages: textMessages,
          jsonMode: true,
          extraHeaders: {
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://www.nexaiintelligence.online",
            "X-Title": "Nexa AI Employee Builder",
          },
        });
        return text ? { text, provider: `openrouter:${model}` } : null;
      });
    }
  }

  const nexaBase = (process.env.NEXA_MODEL_BASE_URL || "").replace(/\/$/, "");
  if (nexaBase) {
    const nexaKey = process.env.NEXA_MODEL_API_KEY || process.env.NEXA_OWN_MODEL_KEY || "nexa-local";
    const nexaModel = process.env.NEXA_MODEL_NAME || process.env.NEXA_OWN_MODEL_NAME || "nexa-default";
    attempts.push(async () => {
      const text = await callOpenAICompat({
        baseUrl: nexaBase.endsWith("/v1") ? nexaBase : `${nexaBase}/v1`,
        model: nexaModel,
        apiKey: nexaKey,
        messages: textMessages,
        jsonMode: true,
      });
      return text ? { text, provider: "nexa" } : null;
    });
  }

  if (attempts.length === 0) {
    console.warn("[agent-builder] no AI API keys configured — using local template");
  } else {
    console.info(`[agent-builder] attempting up to ${attempts.length} model routes`);
  }
  thinking.push(mode === "edit" ? "Applying changes to this employee" : "Building your AI employee");

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (!result?.text) continue;
      const parsed = parseModelJson(result.text);
      if (!parsed) continue;
      if (parsed.off_topic === true) {
        thinking.push("This request is outside the AI Employee Builder");
        return { kind: "off_topic", message: OFF_TOPIC, thinking };
      }
      const proposal =
        (parsed.proposal as Record<string, unknown> | undefined) ||
        (parsed.employee as Record<string, unknown> | undefined);
      if (proposal && typeof proposal === "object") {
        console.info(`[agent-builder] proposal via ${result.provider}`);
        thinking.push("Validating steps against your connectors");
        thinking.push("Preparing proposal for your review");
        return {
          kind: "proposal",
          message: formatLocalStructuredMessage(proposal, params.connections, mode),
          proposal,
          provider: result.provider,
          thinking,
        };
      }
    } catch (e) {
      console.error("[agent-builder]", e);
    }
  }

  console.warn("[agent-builder] all model routes failed — local fallback");
  if (mode === "edit" && params.existingAgent) {
    thinking.push("Keeping current employee; describe a specific change");
    return {
      kind: "proposal",
      message:
        `I'm updating **${params.existingAgent.name || "this employee"}**. ` +
        "Tell me what to change — schedule, a step, or an app (Slack, Notion, Gmail, GitHub).",
      proposal: {
        name: params.existingAgent.name,
        description: params.existingAgent.description || params.existingAgent.purpose,
        purpose: params.existingAgent.purpose,
        trigger: params.existingAgent.schedule?.enabled ? "schedule" : "manual",
        schedule: params.existingAgent.schedule || {
          frequency: "once",
          time: "09:00",
          timezone: "UTC",
          enabled: false,
        },
        steps: params.existingAgent.steps || [],
        notes: "",
      },
      provider: "local_fallback",
      thinking,
    };
  }

  const fallback = localFallbackProposal(lastUser?.content || "", params.connections);
  if (fallback) {
    thinking.push("Preparing proposal for your review");
    return {
      kind: "proposal",
      message: formatLocalStructuredMessage(fallback as Record<string, unknown>, params.connections, mode),
      proposal: fallback,
      provider: "local_fallback",
      thinking,
    };
  }

  return {
    kind: "error",
    message:
      "Could not design that employee yet. Describe a concrete role — for example Notion notes, Slack updates, or Gmail checks.",
    thinking,
  };
}

function looksOffTopic(text: string, mode: "create" | "edit"): boolean {
  const t = text.toLowerCase().trim();
  if (!t) return false;

  const workHints =
    /\b(agent|employee|workflow|automat|schedule|connect|slack|notion|github|gmail|outlook|google|hubspot|buffer|crm|contact|deal|compan(?:y|ies)|list|filter|report|trigger|daily|weekly|hire|post|page|task|step|mcp|oauth|vault|research|summar|update|create a|build (an? |my )?|make (an? )?|change|rename|add|remove|friday|monday|inbox|email)\b/i;
  if (workHints.test(t)) return false;

  if (
    /^(hi|hello|hey|yo|sup|howdy|good (morning|afternoon|evening)|thanks|thank you|ok|okay|cool|nice|bye|goodbye)[\s!.?]*$/i.test(
      t
    )
  ) {
    return true;
  }

  if (
    /\b(weather|poem|joke|what time|search the web|capital of|tell me a story|who is|what is|how are you|how's it going|lyrics|recipe|homework|code this|write (me )?a)\b/i.test(
      t
    )
  ) {
    return true;
  }

  if (t.length < 12 && !/\b(notion|slack|gmail|github|employee|workflow)\b/i.test(t)) {
    return true;
  }

  return false;
}

function parseModelJson(raw: string): Record<string, unknown> | null {
  const text = raw.trim();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* try fence */
  }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim()) as Record<string, unknown>;
    } catch {
      /* */
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      /* */
    }
  }
  return null;
}

function formatLocalStructuredMessage(
  proposal: Record<string, unknown>,
  connections?: Record<string, string>,
  mode: "create" | "edit" = "create"
): string {
  const name = String(proposal.name || "AI employee");
  const purpose = String(proposal.purpose || proposal.description || "");
  const steps = Array.isArray(proposal.steps) ? proposal.steps : [];
  const header =
    mode === "edit"
      ? `Updated draft for **${name}**.`
      : `Here's a draft for **${name}**.`;
  const lines = [
    header,
    purpose ? purpose : "",
    steps.length
      ? "Steps:\n" +
        steps
          .map((s: any, i: number) => `${i + 1}. ${s?.name || s?.actionId || "Step"}`)
          .join("\n")
      : "",
  ].filter(Boolean);
  const tips: string[] = [];
  if (connections?.notion === "connected") {
    tips.push("Notion: pick a parent page from your account list — new pages will be created under it.");
  }
  if (connections?.slack === "connected") {
    tips.push("Slack: pick a channel from your workspace for post steps.");
  }
  if (connections?.buffer === "connected") {
    tips.push("Buffer: pick a channel for create/schedule post steps.");
  }
  if (tips.length) lines.push(tips.join(" "));
  lines.push("After you hire, open the employee and start work. Results show on the Work Board.");
  return lines.join("\n\n");
}

function localFallbackProposal(
  userText: string,
  connections?: Record<string, string>
): Record<string, unknown> | null {
  const t = userText.toLowerCase();
  if (/notion/.test(t) || /research|report|marketing|summar/.test(t)) {
    const wantsResearch = /research|report|marketing|summar|brief|analysis/.test(t);
    const steps: any[] = [];
    if (wantsResearch) {
      steps.push({
        actionId: "local_data.list_from_text",
        name: "Collect research notes",
        config: {},
        onError: "stop",
        requiresApproval: false,
      });
      steps.push({
        actionId: "local_data.report",
        name: "Write summary",
        config: { title: "Research summary" },
        onError: "stop",
        requiresApproval: false,
      });
    }
    steps.push({
      actionId: "notion.create_page",
      name: "Save to Notion",
      config: {},
      onError: "stop",
      requiresApproval: false,
    });
    return {
      name: wantsResearch ? "Research employee" : "Notion employee",
      description: wantsResearch
        ? "Researches a topic, writes a short summary, and saves it to Notion."
        : "Creates structured pages in Notion from your brief.",
      purpose: wantsResearch
        ? "Turn a research request into a Notion page"
        : "Create Notion pages from instructions",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps,
      notes: connections?.notion === "connected" ? "" : "Connect Notion before live runs.",
    };
  }
  if (/slack/.test(t)) {
    return {
      name: "Slack updates employee",
      description: "Posts clear updates to a Slack channel you choose.",
      purpose: "Keep the team informed in Slack",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        {
          actionId: "slack.post_message",
          name: "Post Slack message",
          config: {},
          onError: "stop",
          requiresApproval: false,
        },
      ],
      notes: connections?.slack === "connected" ? "" : "Connect Slack before live runs.",
    };
  }
  if (/gmail|inbox|email/.test(t)) {
    return {
      name: "Inbox helper",
      description: "Helps you review inbox-related work once Gmail is connected.",
      purpose: "Support email triage workflows",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        {
          actionId: "local_data.note",
          name: "Capture inbox notes",
          config: {},
          onError: "stop",
          requiresApproval: false,
        },
        {
          actionId: "local_data.report",
          name: "Summarize next actions",
          config: { title: "Inbox summary" },
          onError: "stop",
          requiresApproval: false,
        },
      ],
      notes: "Connect Gmail under Connections for live inbox actions.",
    };
  }
  if (/hire|employee|assistant|role|ops|sales|content/.test(t)) {
    return {
      name: "Operations employee",
      description: "Captures the brief, produces a short report, and is ready for app steps you add.",
      purpose: "Turn a work brief into a structured result",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        {
          actionId: "local_data.note",
          name: "Capture brief",
          config: {},
          onError: "stop",
          requiresApproval: false,
        },
        {
          actionId: "local_data.report",
          name: "Produce report",
          config: { title: "Work report" },
          onError: "stop",
          requiresApproval: false,
        },
      ],
      notes: "Add Slack or Notion steps after connecting those apps.",
    };
  }
  return null;
}
