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

type ProviderId = "groq" | "gemini" | "openai" | "openrouter" | "anthropic";

interface ProviderConfig {
  id: ProviderId;
  baseUrl: string;
  model: string;
  apiKeyEnv: string;
}

const CLOUD_PROVIDERS: ProviderConfig[] = [
  {
    id: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    apiKeyEnv: "GROQ_API_KEY",
  },
  {
    id: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    apiKeyEnv: "GEMINI_API_KEY",
  },
  {
    id: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  {
    id: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct",
    apiKeyEnv: "OPENROUTER_API_KEY",
  },
];

function getApiKey(envName: string): string | null {
  const raw =
    process.env[envName] ||
    process.env.NEXA_API_KEY ||
    null;
  if (!raw) return null;
  const cleaned = raw.trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function getConfiguredProviders(): string[] {
  return CLOUD_PROVIDERS.filter((p) => !!getApiKey(p.apiKeyEnv)).map((p) => p.id);
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

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...request.recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

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

  const errors: string[] = [];
  const configured = getConfiguredProviders();

  if (configured.length === 0) {
    return (
      "No AI API keys were found on the server. " +
      "In Vercel → Project → Settings → Environment Variables, add GROQ_API_KEY " +
      "(recommended, free), GEMINI_API_KEY, or OPENAI_API_KEY for Production, then Redeploy."
    );
  }

  for (const config of CLOUD_PROVIDERS) {
    const apiKey = getApiKey(config.apiKeyEnv);
    if (!apiKey) continue;

    try {
      const result = await callOpenAICompatible(config, apiKey, messages);
      if (result && result.trim()) return result;
      errors.push(`${config.id}: empty response`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`[Nexa] ${config.id} failed:`, msg);
      errors.push(`${config.id}: ${msg}`);
    }
  }

  return (
    "I could not reach any AI provider with the keys currently configured.\n\n" +
    `Detected keys for: ${configured.join(", ")}.\n` +
    `Details: ${errors.slice(0, 3).join(" | ")}\n\n` +
    "Please verify each key is valid (no extra spaces) and has access to the model, then redeploy."
  );
}

async function callOpenAICompatible(
  config: ProviderConfig,
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (config.id === "openrouter") {
    headers["HTTP-Referer"] =
      process.env.NEXT_PUBLIC_APP_URL || "https://nexa-ai-beryl-one.vercel.app";
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
    throw new Error(`${res.status} ${errText.slice(0, 280)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
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
      return `Could not fetch the website (${data.error || res.status}). Please paste the relevant content instead.`;
    }
    return data.content || "No readable content extracted from the page.";
  } catch {
    return "Could not fetch the website. Please paste the relevant content instead.";
  }
}
