/**
 * Agent Builder LLM call — reuses the multi-provider stack from src/lib/ai.ts patterns.
 * Returns JSON proposal or a refusal for off-topic messages.
 */

import { registryCatalogForPrompt } from "./validate";

const OFF_TOPIC =
  "I'm Nexa's Agent Builder. I can only help you create or modify automation agents.";

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

function buildSystemPrompt(): string {
  return `You are Nexa Agent Builder — a focused assistant that ONLY designs automation agents for Nexa.

You must ONLY help with:
- Creating agents
- Editing agent workflows
- Choosing connectors/actions from the registry below
- Schedules and approval requirements

If the user asks anything unrelated (weather, time, poems, web search, finding emails, general chat), respond with EXACTLY this sentence and nothing else:
${OFF_TOPIC}

Never invent connectors, actions, APIs, or capabilities.
Only use action IDs from this registry:

${registryCatalogForPrompt()}

Prefer implemented=true actions. If the user needs something not implemented, still propose the closest registry actions and note unavailability in "notes".

When the request is about creating/modifying an agent, respond with ONLY valid JSON (no markdown fences):
{
  "off_topic": false,
  "message": "Short human summary of the proposed agent",
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
- Do not claim the agent was created
- Do not execute anything
- Keep configs realistic; empty strings allowed for user to fill later
`;
}

export type BuilderCompleteResult =
  | {
      kind: "off_topic";
      message: string;
    }
  | {
      kind: "proposal";
      message: string;
      proposal: unknown;
      provider?: string;
    }
  | {
      kind: "error";
      message: string;
    };

export async function completeAgentBuilder(params: {
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<BuilderCompleteResult> {
  const system = buildSystemPrompt();
  const textMessages = [
    { role: "system" as const, content: system },
    ...params.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const lastUser = [...params.messages].reverse().find((m) => m.role === "user");
  if (lastUser && looksOffTopic(lastUser.content)) {
    return { kind: "off_topic", message: OFF_TOPIC };
  }

  const geminiKey = getApiKey(
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY"
  );
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
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL || "https://nexa-ai-beryl-one.vercel.app",
          "X-Title": "Nexa Agent Builder",
        },
      });
      return text ? { text, provider: "openrouter" } : null;
    });
  }

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (!result?.text) continue;
      const parsed = parseModelJson(result.text);
      if (!parsed) continue;
      if (parsed.off_topic === true || typeof parsed.message === "string" && parsed.message.trim() === OFF_TOPIC) {
        return { kind: "off_topic", message: OFF_TOPIC };
      }
      if (parsed.proposal) {
        return {
          kind: "proposal",
          message: String(parsed.message || "Here is a proposed agent."),
          proposal: parsed.proposal,
          provider: result.provider,
        };
      }
    } catch (e) {
      console.error("[agent-builder]", e);
    }
  }

  // Deterministic local fallback when providers fail
  const fallback = localFallbackProposal(lastUser?.content || "");
  if (fallback) {
    return {
      kind: "proposal",
      message:
        "Built a local workflow from your description (AI providers unavailable or failed). Review and create when ready.",
      proposal: fallback,
      provider: "local_fallback",
    };
  }

  return {
    kind: "error",
    message:
      "Could not reach an AI provider. Describe a local list/filter/report workflow, or check API keys in Vercel.",
  };
}

function looksOffTopic(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 3) return false;
  const agentHints =
    /\b(agent|workflow|automat|schedule|connect|slack|notion|github|comfy|list|filter|report|trigger|run every|daily)\b/i;
  if (agentHints.test(t)) return false;
  const off =
    /\b(weather|poem|joke|time is|what time|search the web|find 10|email me|who is|capital of)\b/i;
  return off.test(t) && !agentHints.test(t);
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

function localFallbackProposal(userText: string): Record<string, unknown> | null {
  const t = userText.toLowerCase();
  if (
    !/\b(list|filter|report|note|process|clean|local|text|item)\b/.test(t) &&
    !/\bagent\b/.test(t)
  ) {
    return null;
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
    notes: "Fill list text and filter keyword before activating.",
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
      messages: params.messages,
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err.slice(0, 160)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return content ? String(content) : null;
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  system: string;
  messages: { role: string; content: string }[];
}): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`;
  const contents = params.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": params.apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: params.system }] },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err.slice(0, 160)}`);
  }
  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ||
    null;
  return text;
}

export { OFF_TOPIC };
