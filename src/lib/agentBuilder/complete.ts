/**
 * AI Employee Builder LLM call — reuses multi-provider stack.
 * Returns structured Employee card + proposal JSON (never essay chat).
 */

import { registryCatalogForPrompt } from "./validate";

const OFF_TOPIC =
  "I'm Nexa's AI Employee Builder. I can only help you create or modify AI employees for your team — not general chat. Describe a role or workflow (for example: research daily, post to Slack, update HubSpot contacts).";

function getApiKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = process.env[name];
    if (raw && raw.trim()) return raw.trim();
  }
  return null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function connectionSummary(connections?: Record<string, string>): string {
  if (!connections || !Object.keys(connections).length) {
    return "Connection status unknown. Prefer local_data and vault when unsure; note external connectors may need connecting.";
  }
  const lines = Object.entries(connections).map(([id, status]) => `- ${id}: ${status}`);
  return `Live connection status for this user:\n${lines.join("\n")}\nIf status is not \"connected\", still propose the employee but Status must be Connection required.`;
}

function buildSystemPrompt(connections?: Record<string, string>): string {
  return `You are Nexa's AI Employee Builder — not a general chatbot.
Your job: understand the request, propose one AI employee, use only real connectors/actions.

If the user asks anything unrelated (weather, poems, general chat), respond with EXACTLY:
${OFF_TOPIC}

Never invent connectors or action IDs. Only use this registry:

${registryCatalogForPrompt()}

${connectionSummary(connections)}

Respond with ONLY valid JSON (no markdown fences, no essays):
{
  "off_topic": false,
  "intent": "create|update|preview|question",
  "message": "PLAIN TEXT structured card with newlines. Format EXACTLY:\n\nEmployee:\n[name]\n\nRole:\n[role]\n\nGoal:\n[one short line]\n\nConnectors required:\n- [name]\n\nSchedule:\n[Manual | Every day at HH:MM | ...]\n\nWorkflow:\n1. [step]\n2. [step]\n\nApproval:\n[Required / Not required]\n\nStatus:\n[Ready | Connection required | Needs input]\n\nNext:\n[one short action]",
  "proposal": {
    "name": "string",
    "description": "string",
    "purpose": "string",
    "trigger": "manual" | "schedule",
    "schedule": { "frequency": "once" | "daily" | "weekly" | "monthly", "time": "HH:MM", "timezone": "UTC", "enabled": true },
    "steps": [
      { "actionId": "from_registry", "name": "Human step label", "config": {}, "onError": "stop", "requiresApproval": false }
    ],
    "notes": "optional short note"
  }
}

Rules:
- message MUST be the structured card — short fields, no paragraphs, no "Certainly" / "I'd be happy to" / "Feel free"
- Prefer fewest steps that achieve the goal
- CRM → hubspot.*; Slack → slack.*; Notion → notion.*; social → buffer.*; images → ideogram.*; custom → mcp.call_tool only
- If a connector is not connected: Status = Connection required; Next = Connect [name]
- If info is missing: Status = Needs input; Next = ONE focused question only
- If enough info: Status = Ready; Next = Create employee
- Never claim Created, Active, Succeeded, or that work ran
- Schedules: once/manual, daily, weekly, monthly (no hourly). time HH:MM
- When user updates (\"add Slack\", \"every Friday\"): same JSON, update the same draft
`;
}

export type BuilderCompleteResult =
  | { kind: "off_topic"; message: string; thinking?: string[] }
  | {
      kind: "proposal";
      message: string;
      proposal: unknown;
      provider?: string;
      thinking?: string[];
    }
  | { kind: "error"; message: string; thinking?: string[] };

export async function completeAgentBuilder(params: {
  messages: { role: "user" | "assistant"; content: string }[];
  connections?: Record<string, string>;
}): Promise<BuilderCompleteResult> {
  const thinking: string[] = [];
  thinking.push("Reading your request");
  thinking.push("Checking available connectors and actions");

  const system = buildSystemPrompt(params.connections);
  // Cost control: recent turns + compact summary of older ones (full history kept in UI only)
  const all = params.messages || [];
  const recent = all.slice(-6);
  const older = all.slice(0, Math.max(0, all.length - 6));
  const summary =
    older.length > 0
      ? older
          .map((m) => `${m.role}: ${String(m.content || "").slice(0, 120)}`)
          .join(" | ")
          .slice(0, 600)
      : "";
  const contextPrefix = summary
    ? [
        {
          role: "user" as const,
          content: `[Earlier conversation summary]\n${summary}`,
        },
      ]
    : [];
  const textMessages = [
    { role: "system" as const, content: system },
    ...contextPrefix,
    ...recent.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
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

  type Attempt = () => Promise<{ text: string; provider: string } | null>;
  const attempts: Attempt[] = [];

  if (groqKey) {
    attempts.push(async () => {
      const text = await callOpenAICompat({
        baseUrl: "https://api.groq.com/openai/v1",
        model: "llama-3.1-8b-instant",
        apiKey: groqKey,
        messages: textMessages,
      });
      return text ? { text, provider: "groq" } : null;
    });
  }
  if (geminiKey) {
    attempts.push(async () => {
      const text = await callGemini({
        apiKey: geminiKey,
        model: "gemini-2.5-flash",
        system,
        messages: recent,
      });
      return text ? { text, provider: "gemini" } : null;
    });
  }
  if (deepseekKey) {
    attempts.push(async () => {
      const text = await callOpenAICompat({
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat",
        apiKey: deepseekKey,
        messages: textMessages,
      });
      return text ? { text, provider: "deepseek" } : null;
    });
  }
  if (openrouterKey) {
    attempts.push(async () => {
      const text = await callOpenAICompat({
        baseUrl: "https://openrouter.ai/api/v1",
        model: "deepseek/deepseek-chat-v3-0324",
        apiKey: openrouterKey,
        messages: textMessages,
        extraHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://www.nexaiintelligence.online",
          "X-Title": "Nexa AI Employee Builder",
        },
      });
      return text ? { text, provider: "openrouter" } : null;
    });
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
      });
      return text ? { text, provider: "nexa" } : null;
    });
  }

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (!result?.text) continue;
      const parsed = parseModelJson(result.text);
      if (!parsed) continue;
      if (
        parsed.off_topic === true ||
        (typeof parsed.message === "string" &&
          parsed.message.includes("AI Employee Builder") &&
          parsed.message.includes("only help"))
      ) {
        thinking.push("Declined off-topic request");
        return { kind: "off_topic", message: OFF_TOPIC, thinking };
      }
      if (parsed.proposal) {
        thinking.push("Validating steps against the connector registry");
        thinking.push("Preparing proposal for your review");
        return {
          kind: "proposal",
          message: String(
            parsed.message ||
              formatLocalStructuredMessage(
                (parsed.proposal as Record<string, unknown>) || {},
                params.connections
              )
          ),
          proposal: parsed.proposal,
          provider: result.provider,
          thinking,
        };
      }
    } catch (e) {
      console.error("[agent-builder]", e);
    }
  }

  thinking.push("AI providers unavailable — using local workflow template");
  const fallback = localFallbackProposal(lastUser?.content || "", params.connections);
  if (fallback) {
    thinking.push("Preparing proposal for your review");
    return {
      kind: "proposal",
      message: formatLocalStructuredMessage(
        fallback as Record<string, unknown>,
        params.connections
      ),
      proposal: fallback,
      provider: "local_fallback",
      thinking,
    };
  }

  return {
    kind: "error",
    message:
      "Could not design that employee yet. Try describing a concrete workflow (list/filter/report, Slack message, HubSpot contact, Notion page) or check AI API keys in Vercel.",
    thinking,
  };
}

function looksOffTopic(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 3) return false;
  const agentHints =
    /\b(agent|employee|workflow|automat|schedule|connect|slack|notion|github|hubspot|buffer|ideogram|comfy|crm|contact|deal|compan|list|filter|report|trigger|run every|daily|hire|post|message|page|team|role|task|step|action|build|create|make|mcp)\b/i;
  if (agentHints.test(t)) return false;
  const off =
    /\b(weather|poem|joke|time is|what time|search the web|find 10|email me|who is|capital of|tell me a story|write a song)\b/i;
  return off.test(t);
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
  const connLines = [...connectors].map((c) => {
    if (connections?.[c] === "connected") return `- ${c} ✓`;
    return `- ${c}`;
  });
  const needConnect = [...connectors].some((c) => connections?.[c] !== "connected");
  const approval = steps.some((s) => s.requiresApproval) ? "Required" : "Not required";
  const status = needConnect ? "Connection required" : steps.length ? "Ready" : "Needs input";
  const next = needConnect
    ? `Connect ${[...connectors].filter((c) => connections?.[c] !== "connected").join(", ") || "required tools"}.`
    : "Create employee";
  const wf = steps.map((s, i) => `${i + 1}. ${s.name || s.actionId || "Step"}`).join("\n");
  return [
    "Employee:",
    name,
    "",
    "Role:",
    role,
    "",
    "Goal:",
    goal.slice(0, 120),
    "",
    "Connectors required:",
    connLines.length ? connLines.join("\n") : "- None (built-in tools)",
    "",
    "Schedule:",
    humanScheduleLabel(proposal.schedule),
    "",
    "Workflow:",
    wf || "1. Complete assigned work",
    "",
    "Approval:",
    approval,
    "",
    "Status:",
    status,
    "",
    "Next:",
    next,
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
    return {
      name: "Deal Review Employee",
      description: userText.slice(0, 200),
      purpose: "Sales Operations",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        { actionId: "hubspot.search_contacts", name: "Find contacts", config: { query: "" }, onError: "stop" },
        { actionId: "hubspot.list_deals", name: "List deals", config: { limit: "10" }, onError: "continue" },
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
      notes:
        connections?.slack === "connected"
          ? "Slack is connected."
          : "Connect Slack under Connections before these steps can run.",
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
      notes:
        connections?.notion === "connected"
          ? "Notion is connected."
          : "Connect Notion under Connections before these steps can run.",
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
      notes:
        connections?.buffer === "connected"
          ? "Buffer is connected."
          : "Connect Buffer under Connections before these steps can run.",
    };
  }
  if (wantsMcp) {
    return {
      name: "Custom Connector Employee",
      description: userText.slice(0, 200),
      purpose: "Custom tool runner",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC", enabled: false },
      steps: [
        { actionId: "mcp.call_tool", name: "Call approved tool", config: { tool: "", args: "{}" }, onError: "stop" },
      ],
      notes:
        connections?.mcp === "connected"
          ? "Custom connector is connected. Use an approved tool name."
          : "Connect your custom connector under Connections first.",
    };
  }

  const daily = /\b(every morning|daily|each day)\b/.test(t);
  return {
    name: daily ? "Daily list processor" : "List processor",
    description: userText.slice(0, 200),
    purpose: "Operations",
    trigger: daily ? "schedule" : "manual",
    schedule: {
      frequency: daily ? "daily" : "once",
      time: "09:00",
      timezone: "UTC",
      enabled: daily,
    },
    steps: [
      {
        actionId: "local_data.list_from_text",
        name: "Load list",
        config: { text: "", separator: "newline" },
        onError: "stop",
      },
      {
        actionId: "local_data.filter",
        name: "Filter items",
        config: { keyword: "", mode: "include" },
        onError: "stop",
      },
      {
        actionId: "local_data.report",
        name: "Build report",
        config: { title: "Processed list" },
        onError: "stop",
      },
    ],
    notes: "Uses built-in tools only — no external connector required.",
  };
}

async function callOpenAICompat(params: {
  baseUrl: string;
  model: string;
  apiKey: string;
  messages: { role: string; content: string }[];
  extraHeaders?: Record<string, string>;
}): Promise<string | null> {
  const res = await fetchWithTimeout(`${params.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
      ...(params.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.2,
      messages: params.messages,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  system: string;
  messages: { role: string; content: string }[];
}): Promise<string | null> {
  const contents = params.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.system }] },
      contents,
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim() || null;
}
