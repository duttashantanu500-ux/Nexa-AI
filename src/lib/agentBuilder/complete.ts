/**
 * AI Employee Builder LLM call — multi-provider with local fallback.
 * Supports create (new hire) and edit (existing employee) modes.
 */
import { registryCatalogForPrompt } from "./validate";
import { callOpenAICompat, callGemini, callOllama } from "./modelClients";

const OFF_TOPIC_CREATE =
  "I'm here to help you hire and shape AI employees — roles that use your tools (Notion, Slack, HubSpot, Buffer, and more).\n\n" +
  "Try something like:\n" +
  "• Create a Notion page after each meeting\n" +
  "• List new HubSpot contacts and summarize in Slack\n" +
  "• Schedule a Buffer post every Monday\n\n" +
  "What should your next AI employee do?";

const OFF_TOPIC_EDIT =
  "I'm helping you update this AI employee — schedule, tools, steps, or purpose.\n\n" +
  "Try:\n" +
  "• Change schedule to every Friday at 5 PM\n" +
  "• Add a Slack notification step\n" +
  "• Use a different Notion parent page\n\n" +
  "What would you like to change?";

function getApiKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = process.env[name];
    if (raw && raw.trim()) return raw.trim();
  }
  return null;
}

function connectionSummary(connections?: Record<string, string>): string {
  if (!connections || !Object.keys(connections).length) {
    return "Connection status unknown.";
  }
  const lines = Object.entries(connections).map(([id, status]) => `- ${id}: ${status}`);
  return `Live connection status:\n${lines.join("\n")}\nIf not connected, Status must be Connection required. When a connector IS connected, do NOT ask the user to "set a default page" as a blocker — instead guide them to choose or confirm a parent page/channel inside the workflow config, or propose a sensible config they can edit.`;
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
${stepLines || "  (none)"}

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
  }
): string {
  if (mode === "edit") {
    return `You are Nexa's AI Employee editor for an EXISTING employee — not a general chatbot and not the new-hire assistant.\n${existingAgentSummary(existing)}\n\nRegistry (only these actions):\n${registryCatalogForPrompt()}\n\n${connectionSummary(connections)}\n\nRespond with ONLY valid JSON:\n{"off_topic":false,"intent":"update","message":"short note about what you changed","proposal":{"name":"string","description":"string","purpose":"string","trigger":"manual|schedule","schedule":{"frequency":"once|daily|weekly|monthly","time":"HH:MM","timezone":"UTC","enabled":true},"steps":[{"actionId":"from_registry","name":"label","config":{},"onError":"stop","requiresApproval":false}],"notes":""}}\n\nRules: preserve existing steps the user did not ask to change; fewest changes; CRM=hubspot.*; Slack=slack.*; Notion=notion.*; social=buffer.*.\nWhen Notion is connected, prefer guiding the user to pick a parent page in config rather than blocking with "set a default page".\nIf the user only greets, respond with {"off_topic":true,"message":"warm redirect toward changing schedule, tools, or steps"}. Never say you are here to create new AI employees.`;
  }

  return `You are Nexa's AI Employee Builder — not a general chatbot.\nPropose one AI employee using only this registry:\n\n${registryCatalogForPrompt()}\n\n${connectionSummary(connections)}\n\nRespond with ONLY valid JSON:\n{"off_topic":false,"intent":"create","message":"short note","proposal":{"name":"string","description":"string","purpose":"string","trigger":"manual|schedule","schedule":{"frequency":"once|daily|weekly|monthly","time":"HH:MM","timezone":"UTC","enabled":true},"steps":[{"actionId":"from_registry","name":"label","config":{},"onError":"stop","requiresApproval":false}],"notes":""}}\n\nRules: fewest steps; CRM=hubspot.*; Slack=slack.*; Notion=notion.*; social=buffer.*; custom=mcp.call_tool.\nIf connector not connected: still propose, connection required. When connector IS connected (e.g. notion: connected), do not block on "set a default page" — propose the step and ask which Notion page/parent to use, or leave parent config empty for the user to set on the employee page.\nNever claim work ran. Schedules: once/daily/weekly/monthly only.\nIf the user is only greeting, joking, or asking general questions unrelated to hiring/configuring an AI employee, respond with {"off_topic":true,"message":"warm redirect toward describing a role or workflow"} — never invent a fake employee for small talk.`;
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
}): Promise<BuilderCompleteResult> {
  const mode = params.mode === "edit" ? "edit" : "create";
  const OFF_TOPIC = mode === "edit" ? OFF_TOPIC_EDIT : OFF_TOPIC_CREATE;
  const thinking: string[] = [];
  thinking.push(mode === "edit" ? "Reading change request for this employee" : "Reading your request");
  thinking.push("Checking available connectors and actions");

  const system = buildSystemPrompt(params.connections, mode, params.existingAgent);
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
        "Tell me what to change — schedule, a step, or a tool (Slack, Notion, HubSpot, Buffer).",
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
      "Could not design that employee yet. Try a concrete workflow — for example a Notion page, Slack message, or HubSpot contact.",
    thinking,
  };
}

function looksOffTopic(text: string, mode: "create" | "edit"): boolean {
  const t = text.toLowerCase().trim();
  if (!t) return false;

  const workHints =
    /\b(agent|employee|workflow|automat|schedule|connect|slack|notion|github|hubspot|buffer|ideogram|crm|contact|deal|compan(?:y|ies)|list|filter|report|trigger|daily|weekly|hire|post|page|task|step|mcp|oauth|vault|comfy|research|summar|update|create a|build (an? |my )?|make (an? )?|change|rename|add|remove|friday|monday)\b/i;
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

  if (t.length < 12 && !/\b(notion|slack|hubspot|buffer|agent|employee|workflow)\b/i.test(t)) {
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
  if (connections?.notion === "connected") {
    lines.push(
      "Notion is connected. On the employee page you can set which parent page to use, or tell me the page name to target."
    );
  }
  return lines.join("\n\n");
}

function localFallbackProposal(
  userText: string,
  connections?: Record<string, string>
): Record<string, unknown> | null {
  const t = userText.toLowerCase();
  if (/notion/.test(t)) {
    return {
      name: "Notion page helper",
      description: "Creates or updates Notion pages from your instructions.",
      purpose: "Help with Notion pages",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        {
          actionId: "notion.create_page",
          name: "Create Notion page",
          config: {},
          onError: "stop",
          requiresApproval: true,
        },
      ],
      notes:
        connections?.notion === "connected"
          ? "Notion is connected — set parent page on the employee or tell me which page to use."
          : "",
    };
  }
  if (/slack/.test(t)) {
    return {
      name: "Slack messenger",
      description: "Sends messages to Slack channels.",
      purpose: "Post to Slack",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        {
          actionId: "slack.post_message",
          name: "Send Slack message",
          config: {},
          onError: "stop",
          requiresApproval: true,
        },
      ],
      notes: "",
    };
  }
  if (/hubspot|crm|contact|deal/.test(t)) {
    return {
      name: "HubSpot helper",
      description: "Works with HubSpot contacts and deals.",
      purpose: "CRM assistance",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        {
          actionId: "hubspot.list_contacts",
          name: "List contacts",
          config: {},
          onError: "stop",
          requiresApproval: false,
        },
      ],
      notes: "",
    };
  }
  if (/buffer|social|linkedin|twitter|post/.test(t)) {
    return {
      name: "Social poster",
      description: "Creates or schedules Buffer posts.",
      purpose: "Social scheduling",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        {
          actionId: "buffer.create_post",
          name: "Create or schedule post",
          config: {},
          onError: "stop",
          requiresApproval: true,
        },
      ],
      notes: "",
    };
  }
  return {
    name: "List processor",
    description: "Processes text lists with built-in tools.",
    purpose: "Local list processing",
    trigger: "manual",
    schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
    steps: [
      { actionId: "local_data.list_from_text", name: "Build list from text", config: {}, onError: "stop" },
      { actionId: "local_data.report", name: "Build report", config: { title: "Processed list" }, onError: "stop" },
    ],
    notes: "Uses built-in tools only — no external connector required.",
  };
}
