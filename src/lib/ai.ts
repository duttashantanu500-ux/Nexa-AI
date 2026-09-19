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

type ProviderId =
  | "groq"
  | "gemini"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "browser"
  | "auto";

interface ProviderConfig {
  id: ProviderId;
  baseUrl?: string;
  model?: string;
  apiKeyEnv?: string;
}

/**
 * Nexa Intelligence
 * -----------------
 * Users only ever see "Nexa Intelligence".
 * Supports:
 *  - Cloud providers (Groq, Gemini, OpenAI, Anthropic, OpenRouter)
 *  - Browser engine (Transformers.js – zero cost, unlimited)
 *
 * Priority is controlled by NEXA_PROVIDER env variable.
 */

const CLOUD_PROVIDERS: Record<string, ProviderConfig> = {
  groq: {
    id: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    apiKeyEnv: "GROQ_API_KEY",
  },
  gemini: {
    id: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    apiKeyEnv: "GEMINI_API_KEY",
  },
  openai: {
    id: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  anthropic: {
    id: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet-latest",
    apiKeyEnv: "ANTHROPIC_API_KEY",
  },
  openrouter: {
    id: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct",
    apiKeyEnv: "OPENROUTER_API_KEY",
  },
};

function getPreferredProvider(): ProviderId {
  const forced = (process.env.NEXA_PROVIDER || "auto").toLowerCase() as ProviderId;
  if (forced && forced !== "auto") return forced;
  return "auto";
}

function getApiKey(envName?: string): string | null {
  if (!envName) return null;
  return process.env[envName] || process.env.NEXA_API_KEY || null;
}

/**
 * Main entry point used by the rest of the app.
 * Never exposes provider or model names.
 */
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

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...request.recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Attach extra context
  if (request.websiteContent && messages.length > 1) {
    const last = messages[messages.length - 1];
    if (last.role === "user") {
      last.content += `\n\n[Website content for analysis]\n${request.websiteContent.slice(0, 12000)}`;
    }
  }

  if (request.imageDataUrl && messages.length > 1) {
    const last = messages[messages.length - 1];
    if (last.role === "user") {
      last.content += `\n\n[User attached an image. Analyze it in the context of the current workspace and business goals.]`;
    }
  }

  const preferred = getPreferredProvider();

  // 1. Try cloud providers first (unless browser is forced)
  if (preferred !== "browser") {
    const order: ProviderId[] =
      preferred === "auto"
        ? ["groq", "gemini", "openai", "openrouter", "anthropic"]
        : [preferred];

    for (const id of order) {
      const config = CLOUD_PROVIDERS[id];
      if (!config) continue;

      const apiKey = getApiKey(config.apiKeyEnv);
      if (!apiKey) continue;

      try {
        const result = await callCloudProvider(config, apiKey, messages);
        if (result) return result;
      } catch (err) {
        console.error(`[Nexa] ${id} failed:`, err);
      }
    }
  }

  // 2. Browser engine fallback is handled on the client side.
  //    Here we return a special signal so the client can use Transformers.js
  //    (Because Transformers.js must run in the browser, not on the server)
  return "__USE_BROWSER_ENGINE__";
}

async function callCloudProvider(
  config: ProviderConfig,
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string | null> {
  if (config.id === "anthropic") {
    return callAnthropic(config, apiKey, messages);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (config.id === "openrouter") {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://nexa.app";
    headers["X-Title"] = "Nexa";
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.65,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Nexa] ${config.id} error:`, errText);
    return null;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

async function callAnthropic(
  config: ProviderConfig,
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string | null> {
  const system = messages.find((m) => m.role === "system")?.content || "";
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system,
      messages: chatMessages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[Nexa] Anthropic error:", errText);
    return null;
  }

  const data = await res.json();
  return data.content?.[0]?.text || null;
}

/**
 * Website content fetcher
 */
export async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const res = await fetch("/api/fetch-website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      return `Could not fetch the website (${data.error || res.status}). Please paste the relevant content instead.`;
    }
    return data.content || "No readable content extracted from the page.";
  } catch {
    return "Could not fetch the website. Please paste the relevant content instead.";
  }
}
