/**
 * AI Employee Builder LLM call — multi-provider with local fallback.
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
  return `Live connection status:\n${lines.join("\n")}\nIf status is not \"connected\", you may still propose that connector's actions, but your message MUST say the user needs to connect it under Connections before those steps will run.`;
}

function buildSystemPrompt(connections?: Record<string, string>): string {
  return `You are Nexa AI Employee Builder — you ONLY design AI employees for Nexa.

If the user asks anything unrelated, respond with EXACTLY this sentence and nothing else:\n${OFF_TOPIC}

Only use action IDs from this registry:\n${registryCatalogForPrompt()}\n\n${connectionSummary(connections)}

Prefer implemented=true actions. Built-in tools (local_data, vault) work without OAuth.
External tools need a connected account.

When creating/modifying an AI employee, respond with ONLY valid JSON (no markdown fences):
{
  "off_topic": false,
  "message": "Short human summary including which connectors are connected vs need connecting",
  "proposal": {
    "name": "string",
    "description": "string",
    "purpose": "string",
    "trigger": "manual" | "schedule",
    "schedule": { "frequency": "once" | "daily" | "weekly" | "monthly", "time": "HH:MM", "timezone": "UTC" },
    "steps": [
      { "actionId": "local_data.list_from_text", "config": { "text": "...", "separator": "newline" }, "onError": "stop" }
    ],
    "notes": "optional"
  }
}

Rules:
- steps[].actionId must be from the registry
- Do not claim the employee was created or that steps already ran
- CRM/contacts/deals/companies → hubspot.*; Slack → slack.*; Notion → notion.*; social → buffer.*; images → ideogram.*
- Custom MCP tools → mcp.call_tool only with exact tool names; never invent tool names
- You may mix multiple connectors in one employee
- Schedules: daily|weekly|monthly (not hourly)
`;
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
  const textMessages = [
    { role: "system" as const, content: system },
    ...params.messages.map((m) => ({
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
        messages: params.messages,
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
          message: String(parsed.message || "Here is a proposed AI employee."),
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
    const notes =
      typeof (fallback as { notes?: string }).notes === "string"
        ? String((fallback as { notes?: string }).notes)
        : "";
    return {
      kind: "proposal",
      message:
        "Built a starter workflow from your description. Review the steps below — connect any external tools under Connections before those steps can run live." +
        (notes ? `\n\n${notes}` : ""),
      proposal: fallback,
      provider: "local_fallback",
      thinking,
    };
  }

  return {
    kind: "error",
    message:
      "Could not design that employee yet. Try describing a concrete workflow (list/filter/report, Slack, HubSpot, Notion) or check AI API keys in Vercel.",
    thinking,
  };
}

function looksOffTopic(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 3) return false;
  const agentHints =
    /\b(agent|employee|workflow|automat|schedule|connect|slack|notion|github|hubspot|buffer|ideogram|comfy|crm|contact|deal|compan|list|filter|report|trigger|run every|daily|hire|post|message|page|mcp|tool)\b/i;
  if (agentHints.test(t)) return false;
  const off =
    /\b(weather|poem|joke|time is|what time|search the web|find 10|email me|who is|capital of)\b/i;
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
      name: "HubSpot CRM helper",
      description: userText.slice(0, 200),
      purpose: "Work with HubSpot contacts, companies, or deals",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC" },
      steps: [
        { actionId: "hubspot.search_contacts", config: { query: "" }, onError: "stop" },
        { actionId: "hubspot.list_deals", config: { limit: "10" }, onError: "continue" },
      ],
      notes:
        connections?.hubspot === "connected"
          ? "HubSpot is connected."
          : "Connect HubSpot under Connections before these steps can run.",
    };
  }
  if (wantsSlack) {
    return {
      name: "Slack messenger",
      description: userText.slice(0, 200),
      purpose: "List channels and send Slack messages",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC" },
      steps: [
        { actionId: "slack.list_channels", config: {}, onError: "stop" },
        { actionId: "slack.post_message", config: { channel: "", text: "" }, onError: "stop" },
      ],
      notes:
        connections?.slack === "connected"
          ? "Slack is connected."
          : "Connect Slack under Connections before these steps can run.",
    };
  }
  if (wantsNotion) {
    return {
      name: "Notion scribe",
      description: userText.slice(0, 200),
      purpose: "Search and create Notion pages",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC" },
      steps: [
        { actionId: "notion.search", config: { query: "" }, onError: "stop" },
        { actionId: "notion.create_page", config: { title: "", content: "" }, onError: "stop" },
      ],
      notes:
        connections?.notion === "connected"
          ? "Notion is connected."
          : "Connect Notion under Connections before these steps can run.",
    };
  }
  if (wantsBuffer) {
    return {
      name: "Social poster",
      description: userText.slice(0, 200),
      purpose: "View Buffer channels and create posts",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC" },
      steps: [
        { actionId: "buffer.list_channels", config: {}, onError: "stop" },
        { actionId: "buffer.create_post", config: { channel: "", text: "" }, onError: "stop" },
      ],
      notes:
        connections?.buffer === "connected"
          ? "Buffer is connected."
          : "Connect Buffer under Connections before these steps can run.",
    };
  }
  if (wantsMcp) {
    return {
      name: "Custom MCP tool runner",
      description: userText.slice(0, 200),
      purpose: "Call a tool from your connected MCP server",
      trigger: "manual",
      schedule: { frequency: "once", time: "09:00", timezone: "UTC" },
      steps: [{ actionId: "mcp.call_tool", config: { tool: "", args: "{}" }, onError: "stop" }],
      notes:
        connections?.mcp === "connected"
          ? "MCP is connected. Set the exact tool name from your server discovery list."
          : "Connect an MCP server under Connections first, then set the tool name from the discovered list.",
    };
  }

  const daily = /\b(every morning|daily|each day)\b/.test(t);
  return {
    name: daily ? "Daily list processor" : "List processor",
    description: userText.slice(0, 200),
    purpose: "Process text into a filtered list and report",
    trigger: daily ? "schedule" : "manual",
    schedule: {
      frequency: daily ? "daily" : "once",
      time: "09:00",
      timezone: "UTC",
    },
    steps: [
      {
        actionId: "local_data.list_from_text",
        config: { text: "", separator: "newline" },
        onError: "stop",
      },
      {
        actionId: "local_data.filter",
        config: { keyword: "", mode: "include" },
        onError: "stop",
      },
      {
        actionId: "local_data.report",
        config: { title: "Processed list" },
        onError: "stop",
      },
    ],
    notes:
      "Uses built-in tools only — no external connector required. Fill list text and filter keyword before activating.",
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
