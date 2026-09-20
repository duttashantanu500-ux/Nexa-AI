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
  ms = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Current free-tier friendly Gemini models (tried in order)
const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

const GROQ_MODELS = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"];

export async function callNexaIntelligence(
  request: AIRequest
): Promise<string> {
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
        `\n\nHere is the website content to analyze:\n` +
        request.websiteContent.slice(0, 12000);
    }
  }

  const geminiKey = getApiKey("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY");
  const groqKey = getApiKey("GROQ_API_KEY");

  // 1) Gemini first (free tier is strong and supports images)
  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      try {
        const result = await callGeminiNative({
          apiKey: geminiKey,
          model,
          systemPrompt,
          messages: textMessages.filter((m) => m.role !== "system"),
          imageDataUrl: request.imageDataUrl,
        });
        if (result?.trim()) return result;
      } catch (err: any) {
        console.error(`[Nexa] gemini ${model}:`, err?.message || err);
      }
    }
  }

  // 2) Groq second
  if (groqKey) {
    for (const model of GROQ_MODELS) {
      try {
        const result = await callOpenAICompatible({
          baseUrl: "https://api.groq.com/openai/v1",
          model,
          apiKey: groqKey,
          messages: textMessages,
        });
        if (result?.trim()) return result;
      } catch (err: any) {
        console.error(`[Nexa] groq ${model}:`, err?.message || err);
      }
    }
  }

  return BROWSER_ENGINE_SIGNAL;
}

async function callOpenAICompatible(params: {
  baseUrl: string;
  model: string;
  apiKey: string;
  messages: { role: string; content: string }[];
}): Promise<string | null> {
  const res = await fetchWithTimeout(`${params.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: 0.65,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status} ${errText.slice(0, 220)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
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
        parts[0] = {
          text:
            m.content +
            "\n\nPlease analyze the attached image in context of this business request.",
        };
      }
    }

    return {
      role: m.role === "assistant" ? "model" : "user",
      parts,
    };
  });

  // Gemini needs alternating roles
  const merged: typeof contents = [];
  for (const c of contents) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === c.role) {
      prev.parts = [...prev.parts, ...c.parts];
    } else {
      merged.push({ ...c, parts: [...c.parts] });
    }
  }

  // Must start with user
  if (merged.length && merged[0].role !== "user") {
    merged.unshift({ role: "user", parts: [{ text: "Continue." }] });
  }

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": params.apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: params.systemPrompt }] },
      contents: merged,
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status} ${errText.slice(0, 220)}`);
  }

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || "")
      .join("") || null;
  return text;
}

export async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const res = await fetch("/api/fetch-website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      return `Could not fetch that website right now. ${data.error || ""}`.trim();
    }
    return data.content || "No readable content was found on that page.";
  } catch {
    return "Could not fetch that website right now. You can paste the page text instead.";
  }
}
