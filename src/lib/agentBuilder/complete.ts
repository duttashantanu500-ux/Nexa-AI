/**
 * AI Employee Builder LLM call — multi-provider with local fallback.
 */
import { registryCatalogForPrompt } from "./validate";
import { callOpenAICompat, callGemini } from "./modelClients";

const OFF_TOPIC =
  "I'm Nexa's AI Employee Builder. I can only help you create or modify AI employees for your team — not general chat. Describe a role or workflow (for example: research daily, post to Slack, update HubSpot contacts).";

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
  return `Live connection status:\n${lines.join("\n")}\nIf not connected, Status must be Connection required.`;
}

function buildSystemPrompt(connections?: Record<string, string>): string {
  return `You are Nexa's AI Employee Builder — not a general chatbot.\nPropose one AI employee using only this registry:\n\n${registryCatalogForPrompt()}\n\n${connectionSummary(connections)}\n\nRespond with ONLY valid JSON:\n{"off_topic":false,"intent":"create","message":"short note","proposal":{"name":"string","description":"string","purpose":"string","trigger":"manual|schedule","schedule":{"frequency":"once|daily|weekly|monthly","time":"HH:MM","timezone":"UTC","enabled":true},"steps":[{"actionId":"from_registry","name":"label","config":{},"onError":"stop","requiresApproval":false}],"notes":""}}\n\nRules: fewest steps; CRM=hubspot.*; Slack=slack.*; Notion=notion.*; social=buffer.*; custom=mcp.call_tool.\nIf connector not connected: still propose, connection required. Never claim work ran. Schedules: once/daily/weekly/monthly only.`;
}

export type BuilderCompleteResult =
  | { kind: "off_topic"; message: string; thinking?: string[] }
  | { kind: "proposal"; message: string; proposal: unknown; provider?: string; thinking?: string[] }
  | { kind: "error"; message: string; thinking?: string[] };

export async function completeAgentBuilder(params: {
  messages: { role: "user" | "assistant"; content: string }[];
  connections?: Record<string, string>;
}): Promise<BuilderCompleteResult> {
  const thinking: string[] = [];
  thinking.push("Reading your request");
  thinking.push("Checking available connectors and actions");

  const system = buildSystemPrompt(params.connections);
  const all = params.messages || [];
  const recent = all.slice(-6);
  const textMessages = [
    { role: "system" as const, content: system },
    ...recent.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const lastUser = [...params.messages].reverse().find((m) => m.role === "user");
  if (lastUser && looksOffTopic(lastUser.content)) {
    thinking.push("Request is outside AI Employee Builder scope");
    return { kind: "off_topic", message: OFF_TOPIC, thinking };
  }

  thinking.push("Designing a workflow from the registry");

  const geminiKey = getApiKey("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY");
  const groqKey = getApiKey("GROQ_API_KEY");
  const deepseekKey = getApiKey("DEEPSEEK_API_KEY");
  const openrouterKey = getApiKey("OPENROUTER_API_KEY");
  const openaiKey = getApiKey("OPENAI_API_KEY");

  type Attempt = () => Promise<{ text: string; provider: string } | null>;
  const attempts: Attempt[] = [];

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

  thinking.push(attempts.length ? `Trying ${attempts.length} model routes` : "No AI API keys — using built-in template");

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (!result?.text) continue;
      const parsed = parseModelJson(result.text);
      if (!parsed) continue;
      if (parsed.off_topic === true) {
        thinking.push("Declined off-topic request");
        return { kind: "off_topic", message: OFF_TOPIC, thinking };
      }
      const proposal =
        (parsed.proposal as Record<string, unknown> | undefined) ||
        (parsed.employee as Record<string, unknown> | undefined);
      if (proposal && typeof proposal === "object") {
        thinking.push(`Model OK (${result.provider})`);
        thinking.push("Validating steps against the connector registry");
        thinking.push("Preparing proposal for your review");
        return {
          kind: "proposal",
          message: formatLocalStructuredMessage(proposal, params.connections),
          proposal,
          provider: result.provider,
          thinking,
        };
      }
    } catch (e) {
      console.error("[agent-builder]", e);
    }
  }

  thinking.push("Cloud models unavailable — using built-in workflow template");
  const fallback = localFallbackProposal(lastUser?.content || "", params.connections);
  if (fallback) {
    thinking.push("Preparing proposal for your review");
    return {
      kind: "proposal",
      message: formatLocalStructuredMessage(fallback as Record<string, unknown>, params.connections),
      proposal: fallback,
      provider: "local_fallback",
      thinking,
    };
  }

  return {
    kind: "error",
    message:
      "Could not design that employee yet. Try a concrete workflow (HubSpot deals, Slack message, Notion page) or check AI API keys.",
    thinking,
  };
}

function looksOffTopic(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 3) return false;
  const agentHints =
    /\b(agent|employee|workflow|automat|schedule|connect|slack|notion|github|hubspot|buffer|ideogram|crm|contact|deal|compan|list|filter|report|trigger|daily|hire|post|message|page|team|role|task|step|action|build|create|make|mcp)\b/i;
  if (agentHints.test(t)) return false;
  return /\b(weather|poem|joke|what time|search the web|capital of|tell me a story)\b/i.test(t);
}

function parseModelJson(text: string): Record<string, unknown> | null {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "");
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function humanScheduleLabel(sch: any): string {
  if (!sch || sch.frequency === "once" || sch.enabled === false) return "Manual";
  const t = sch.time || "09:00";
  if (sch.frequency === "daily") return `Every day at ${t}`;
  if (sch.frequency === "weekly") return `Every week at ${t}`;
  if (sch.frequency === "monthly") return `Every month at ${t}`;
  return String(sch.frequency || "Manual");
}

function formatLocalStructuredMessage(
  proposal: Record<string, unknown>,
  connections?: Record<string, string>
): string {
  const name = String(proposal.name || "AI Employee");
  const role = String(proposal.purpose || proposal.description || "Specialist");
  const goal = String(proposal.description || proposal.purpose || "Complete the assigned workflow.");
  const steps = Array.isArray(proposal.steps) ? (proposal.steps as any[]) : [];
  const connectors = new Set<string>();
  for (const s of steps) {
    const id = String(s.actionId || "");
    const c = id.split(".")[0];
    if (c && c !== "local_data" && c !== "vault") connectors.add(c);
  }
  const connLines = [...connectors].map((c) =>
    connections?.[c] === "connected" ? `- ${c} ✓` : `- ${c}`
  );
  const needConnect = [...connectors].some((c) => connections?.[c] !== "connected");
  const approval = steps.some((s) => s.requiresApproval) ? "Required" : "Not required";
  const status = needConnect ? "Connection required" : steps.length ? "Ready" : "Needs input";
  const next = needConnect
    ? `Connect ${[...connectors].filter((c) => connections?.[c] !== "connected").join(", ") || "required tools"}.`
    : "Create employee";
  const wf = steps.map((s, i) => `${i + 1}. ${s.name || s.actionId || "Step"}`).join("\n");
  return [
    "Employee:", name, "",
    "Role:", role, "",
    "Goal:", goal.slice(0, 120), "",
    "Connectors required:",
    connLines.length ? connLines.join("\n") : "- None (built-in tools)", "",
    "Schedule:", humanScheduleLabel(proposal.schedule), "",
    "Workflow:", wf || "1. Complete assigned work", "",
    "Approval:", approval, "",
    "Status:", status, "",
    "Next:", next,
  ].join("\n");
}

function localFallbackProposal(
  userText: string,
  connections?: Record<string, string>
): Record<string, unknown> | null {
  const t = userText.toLowerCase();
  const wantsHubspot = /\b(hubspot|crm|contact|deal|compan)/.test(t);
  const wantsSlack = /\b(slack|message|channel)\b/.test(t);
  const wantsNotion = /\b(notion|page|doc)\b/.test(t);
  const wantsBuffer = /\b(buffer|social|linkedin|twitter|post)\b/.test(t);
  const wantsMcp = /\b(mcp|custom tool|custom connector)\b/.test(t);

  if (wantsHubspot) {
    const weekly = /\b(weekly|every week|each week)\b/.test(t);
    const daily = /\b(every morning|daily|each day)\b/.test(t);
    const freq = weekly ? "weekly" : daily ? "daily" : "once";
    const scheduled = freq !== "once";
    return {
      name: "Deal Review Employee",
      description: userText.slice(0, 200),
      purpose: "Sales Operations",
      trigger: scheduled ? "schedule" : "manual",
      schedule: { frequency: freq, time: "09:00", timezone: "UTC", enabled: scheduled },
      steps: [
        { actionId: "hubspot.list_deals", name: "List open deals", config: { limit: "25" }, onError: "stop" },
        { actionId: "hubspot.search_deals", name: "Search deals needing attention", config: { query: "" }, onError: "continue" },
        { actionId: "hubspot.list_contacts", name: "List related contacts", config: { limit: "10" }, onError: "continue" },
      ],
      notes:
        connections?.hubspot === "connected"
          ? "HubSpot is connected."
          : "Connect HubSpot under Connections before these steps can run.",
    };
  }
  if (wantsSlack) {
    return {
      name: "Slack Summary Employee",
      description: userText.slice(0, 200),
      purpose: "Communication Assistant",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        { actionId: "slack.list_channels", name: "List channels", config: {}, onError: "stop" },
        { actionId: "slack.post_message", name: "Deliver summary", config: { channel: "", text: "" }, onError: "stop", requiresApproval: true },
      ],
      notes: connections?.slack === "connected" ? "Slack is connected." : "Connect Slack under Connections first.",
    };
  }
  if (wantsNotion) {
    return {
      name: "Notion Research Employee",
      description: userText.slice(0, 200),
      purpose: "Knowledge Assistant",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        { actionId: "notion.search", name: "Search Notion", config: { query: "" }, onError: "stop" },
        { actionId: "notion.create_page", name: "Create page", config: { title: "", content: "" }, onError: "stop", requiresApproval: true },
      ],
      notes: connections?.notion === "connected" ? "Notion is connected." : "Connect Notion under Connections first.",
    };
  }
  if (wantsBuffer) {
    return {
      name: "Social Media Employee",
      description: userText.slice(0, 200),
      purpose: "Social Media Manager",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        { actionId: "buffer.list_channels", name: "List channels", config: {}, onError: "stop" },
        { actionId: "buffer.create_post", name: "Schedule or publish", config: { channel: "", text: "" }, onError: "stop", requiresApproval: true },
      ],
      notes: connections?.buffer === "connected" ? "Buffer is connected." : "Connect Buffer under Connections first.",
    };
  }
  if (wantsMcp) {
    return {
      name: "Custom Connector Employee",
      description: userText.slice(0, 200),
      purpose: "Custom tool runner",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [{ actionId: "mcp.call_tool", name: "Call approved tool", config: { tool: "", args: "{}" }, onError: "stop" }],
      notes: connections?.mcp === "connected" ? "Custom connector is connected." : "Connect your custom connector first.",
    };
  }

  const daily = /\b(every morning|daily|each day)\b/.test(t);
  return {
    name: daily ? "Daily list processor" : "List processor",
    description: userText.slice(0, 200),
    purpose: "Operations",
    trigger: daily ? "schedule" : "manual",
    schedule: { frequency: daily ? "daily" : "once", time: "09:00", timezone: "UTC", enabled: daily },
    steps: [
      { actionId: "local_data.list_from_text", name: "Load list", config: { text: "", separator: "newline" }, onError: "stop" },
      { actionId: "local_data.filter", name: "Filter items", config: { keyword: "", mode: "include" }, onError: "stop" },
      { actionId: "local_data.report", name: "Build report", config: { title: "Processed list" }, onError: "stop" },
    ],
    notes: "Uses built-in tools only — no external connector required.",
  };
}
