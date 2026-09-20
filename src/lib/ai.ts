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

function getApiKey(envName: string): string | null {
  const raw = process.env[envName] || null;
  if (!raw) return null;
  const cleaned = raw.trim();
  return cleaned.length > 0 ? cleaned : null;
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

  const groqKey = getApiKey("GROQ_API_KEY");
  const geminiKey = getApiKey("GEMINI_API_KEY");

  // Vision: Gemini first when image is attached
  if (request.imageDataUrl && geminiKey) {
    for (const model of ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"]) {
      try {
        const result = await callGeminiNative({
          apiKey: geminiKey,
          model,
          systemPrompt,
          messages: textMessages.filter((m) => m.role !== "system"),
          imageDataUrl: request.imageDataUrl,
        });
        if (result?.trim()) return result;
      } catch (err) {
        console.error(`[Nexa] gemini vision ${model} failed:`, err);
      }
    }
  }

  // Groq text (prefer fast free-tier friendly model)
  if (groqKey) {
    for (const model of ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]) {
      try {
        const result = await callOpenAICompatible({
          baseUrl: "https://api.groq.com/openai/v1",
          model,
          apiKey: groqKey,
          messages: textMessages,
        });
        if (result?.trim()) return result;
      } catch (err) {
        console.error(`[Nexa] groq ${model} failed:`, err);
      }
    }
  }

  // Gemini text fallback
  if (geminiKey) {
    for (const model of ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"]) {
      try {
        const result = await callGeminiNative({
          apiKey: geminiKey,
          model,
          systemPrompt,
          messages: textMessages.filter((m) => m.role !== "system"),
        });
        if (result?.trim()) return result;
      } catch (err) {
        console.error(`[Nexa] gemini ${model} failed:`, err);
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
    throw new Error(`${res.status} ${errText.slice(0, 200)}`);
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;

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

  const merged: typeof contents = [];
  for (const c of contents) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === c.role) {
      prev.parts = [...prev.parts, ...c.parts];
    } else {
      merged.push(c);
    }
  }

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    throw new Error(`${res.status} ${errText.slice(0, 200)}`);
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
