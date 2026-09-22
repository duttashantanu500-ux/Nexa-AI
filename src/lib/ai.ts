import { buildSystemPrompt } from "./prompts";
import {
  BusinessContext,
  UserType,
  WorkspaceId,
} from "@/types";

export interface AIRequest {
  workspace: WorkspaceId;
  userType: UserType;
  businessContext: BusinessContext | null;
  memories: { content: string; category: string }[];
  recentMessages: { role: "user" | "assistant"; content: string }[];
  userName?: string;
  imageDataUrl?: string;
  websiteContent?: string;
  requestId?: string;
}

export interface AIResult {
  success: boolean;
  content: string;
  provider?: string;
  model?: string;
  requestId?: string;
  error?: string;
}

export const BROWSER_ENGINE_SIGNAL = "__USE_BROWSER_ENGINE__";

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
  ms = 12000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
const GROQ_MODELS = ["llama-3.1-8b-instant"];
const DEEPSEEK_MODELS = ["deepseek-chat"];
const OPENROUTER_MODELS = [
  "deepseek/deepseek-chat-v3-0324",
  "google/gemini-2.5-flash",
];

/** Main entry: Nexa Intelligence → AI Router → Provider */
export async function generateNexaResponse(request: AIRequest): Promise<AIResult> {
  const systemPrompt = buildSystemPrompt({
    workspace: request.workspace,
    userType: request.userType,
    businessContext: request.businessContext,
    memories: request.memories,
    userName: request.userName,
  });

  const textMessages: { role: "system" | "user" | "assistant"; content: string }[] =
    [
      { role: "system", content: systemPrompt },
      ...request.recentMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

  if (request.websiteContent && textMessages.length > 1) {
    const last = textMessages[textMessages.length - 1];
    if (last.role === "user") {
      last.content +=
        `\n\nWebsite summary for context:\n` +
        request.websiteContent.slice(0, 4000);
    }
  }

  const geminiKey = getApiKey(
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY"
  );
  const groqKey = getApiKey("GROQ_API_KEY");
  const deepseekKey = getApiKey("DEEPSEEK_API_KEY");
  const openrouterKey = getApiKey("OPENROUTER_API_KEY");

  // Prefer fast/cheap first when no image; Gemini first when image present
  const hasImage = Boolean(request.imageDataUrl);

  type Attempt = () => Promise<{ content: string; provider: string; model: string } | null>;
  const attempts: Attempt[] = [];

  const pushGemini = () => {
    if (!geminiKey) return;
    for (const model of GEMINI_MODELS) {
      attempts.push(async () => {
        const content = await callGeminiNative({
          apiKey: geminiKey,
          model,
          systemPrompt,
          messages: textMessages.filter((m) => m.role !== "system"),
          imageDataUrl: request.imageDataUrl,
        });
        if (content?.trim()) return { content: content.trim(), provider: "gemini", model };
        return null;
      });
    }
  };

  const pushGroq = () => {
    if (!groqKey || hasImage) return;
    for (const model of GROQ_MODELS) {
      attempts.push(async () => {
        const content = await callOpenAICompatible({
          baseUrl: "https://api.groq.com/openai/v1",
          model,
          apiKey: groqKey,
          messages: textMessages,
        });
        if (content?.trim()) return { content: content.trim(), provider: "groq", model };
        return null;
      });
    }
  };

  const pushDeepseek = () => {
    if (!deepseekKey || hasImage) return;
    for (const model of DEEPSEEK_MODELS) {
      attempts.push(async () => {
        const content = await callOpenAICompatible({
          baseUrl: "https://api.deepseek.com",
          model,
          apiKey: deepseekKey,
          messages: textMessages,
        });
        if (content?.trim()) return { content: content.trim(), provider: "deepseek", model };
        return null;
      });
    }
  };

  const pushOpenRouter = () => {
    if (!openrouterKey || hasImage) return;
    for (const model of OPENROUTER_MODELS) {
      attempts.push(async () => {
        const content = await callOpenAICompatible({
          baseUrl: "https://openrouter.ai/api/v1",
          model,
          apiKey: openrouterKey,
          messages: textMessages,
          extraHeaders: {
            "HTTP-Referer":
              process.env.NEXT_PUBLIC_APP_URL ||
              "https://nexa-ai-beryl-one.vercel.app",
            "X-Title": "Nexa",
          },
        });
        if (content?.trim()) return { content: content.trim(), provider: "openrouter", model };
        return null;
      });
    }
  };

  if (hasImage) {
    pushGemini();
  } else {
    // Speed-first order for text
    pushGroq();
    pushGemini();
    pushDeepseek();
    pushOpenRouter();
  }

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result?.content) {
        return {
          success: true,
          content: result.content,
          provider: result.provider,
          model: result.model,
          requestId: request.requestId,
        };
      }
    } catch (err: any) {
      console.error("[Nexa router]", err?.message || err);
      // continue to next provider
    }
  }

  return {
    success: false,
    content: BROWSER_ENGINE_SIGNAL,
    requestId: request.requestId,
    error: "all_providers_failed",
  };
}

/** Back-compat wrapper used by /api/chat */
export async function callNexaIntelligence(request: AIRequest): Promise<string> {
  const result = await generateNexaResponse(request);
  return result.content;
}

async function callOpenAICompatible(params: {
  baseUrl: string;
  model: string;
  apiKey: string;
  messages: { role: string; content: string }[];
  extraHeaders?: Record<string, string>;
}): Promise<string | null> {
  const res = await fetchWithTimeout(
    `${params.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
        ...(params.extraHeaders || {}),
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: 0.6,
        max_tokens: 1600,
      }),
    },
    12000
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status} ${errText.slice(0, 180)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) return null;
  return String(content);
}

async function callGeminiNative(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: { role: string; content: string }[];
  imageDataUrl?: string;
}): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent`;

  const contents = params.messages.map((m, index) => {
    const isLast = index === params.messages.length - 1;
    const parts: any[] = [{ text: m.content }];

    if (isLast && params.imageDataUrl && m.role === "user") {
      const match = params.imageDataUrl.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
      );
      if (match) {
        parts.push({
          inline_data: {
            mime_type: match[1],
            data: match[2],
          },
        });
      }
    }

    return {
      role: m.role === "assistant" ? "model" : "user",
      parts,
    };
  });

  const merged: typeof contents = [];
  for (const c of contents) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === c.role) {
      prev.parts = [...prev.parts, ...c.parts];
    } else {
      merged.push({ ...c, parts: [...c.parts] });
    }
  }

  if (merged.length && merged[0].role !== "user") {
    merged.unshift({ role: "user", parts: [{ text: "Continue." }] });
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: params.systemPrompt }] },
        contents: merged,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1600,
        },
      }),
    },
    14000
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status} ${errText.slice(0, 180)}`);
  }

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || "")
      .join("") || null;
  if (!text?.trim()) return null;
  return text;
}
