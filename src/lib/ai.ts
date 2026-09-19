import { buildSystemPrompt } from "./prompts";
import { BusinessContext, UserType, WorkspaceId } from "@/types";

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

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type Provider = "groq" | "gemini" | "openai" | "anthropic" | "openrouter" | "ollama";

const defaultModels: Record<Provider, string> = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  openrouter: "openai/gpt-4o-mini",
  ollama: "llama3.2",
};

const providerNames = /\b(groq|gemini|openai|anthropic|openrouter|ollama|llama(?:[-\s\d.]|\w)*|gpt(?:[-\s\d.]|\w)*|claude(?:[-\s\d.]|\w)*)\b/gi;

function hideProviderNames(text: string): string {
  return text.replace(providerNames, "Nexa Intelligence");
}

function buildMessages(request: AIRequest, systemPrompt: string): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: `${systemPrompt}\n\nNever mention the underlying AI provider or model. Refer to yourself only as Nexa Intelligence.` },
    ...request.recentMessages.map((message) => ({ ...message })),
  ];

  if (request.websiteContent && messages.length > 1) {
    const last = messages[messages.length - 1];
    if (last.role === "user") last.content += `\n\n[Website content provided for analysis]\n${request.websiteContent.slice(0, 12000)}`;
  }
  if (request.imageDataUrl && messages.length > 1) {
    const last = messages[messages.length - 1];
    if (last.role === "user") last.content += "\n\n[User attached an image. Analyze it in the context of the current workspace and business goals.]";
  }
  return messages;
}

function configuredProvider(): { provider: Provider; apiKey?: string; model: string } | null {
  const requested = process.env.NEXA_AI_PROVIDER?.toLowerCase() as Provider | undefined;
  const providers: Provider[] = ["groq", "gemini", "openai", "anthropic", "openrouter", "ollama"];
  const provider = requested && providers.includes(requested)
    ? requested
    : providers.find((name) => process.env[`${name.toUpperCase()}_API_KEY`] || name === "ollama");
  if (!provider) return null;
  const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (provider !== "ollama" && !apiKey) return null;
  return { provider, apiKey, model: process.env.NEXA_AI_MODEL || defaultModels[provider] };
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`Provider request failed with status ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function callProvider(messages: ChatMessage[]): Promise<string> {
  const config = configuredProvider();
  if (!config) throw new Error("No AI provider is configured");
  const { provider, apiKey, model } = config;
  const baseUrl = process.env.NEXA_AI_BASE_URL || (provider === "ollama" ? process.env.OLLAMA_BASE_URL : undefined);

  if (provider === "gemini") {
    const contents = messages.filter((message) => message.role !== "system").map((message) => ({
      role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }],
    }));
    const system = messages.find((message) => message.role === "system")?.content;
    const data = await readResponse(await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents }),
    }));
    return String((data.candidates as { content?: { parts?: { text?: string }[] } }[])?.[0]?.content?.parts?.[0]?.text || "");
  }

  if (provider === "anthropic") {
    const system = messages.find((message) => message.role === "system")?.content;
    const data = await readResponse(await fetch(baseUrl || "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, system, messages: messages.filter((message) => message.role !== "system"), max_tokens: 2048 }),
    }));
    return String((data.content as { text?: string }[])?.[0]?.text || "");
  }

  const endpoint = provider === "ollama"
    ? `${baseUrl || "http://localhost:11434"}/api/chat`
    : `${baseUrl || ({ groq: "https://api.groq.com/openai/v1", openai: "https://api.openai.com/v1", openrouter: "https://openrouter.ai/api/v1" }[provider])}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const data = await readResponse(await fetch(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 2048, ...(provider === "ollama" ? { stream: false } : {}) }),
  }));
  return provider === "ollama"
    ? String((data.message as { content?: string })?.content || "")
    : String((data.choices as { message?: { content?: string } }[])?.[0]?.message?.content || "");
}

export async function callNexaIntelligence(request: AIRequest): Promise<string> {
  const systemPrompt = buildSystemPrompt({ workspace: request.workspace, userType: request.userType, businessContext: request.businessContext, memories: request.memories, userName: request.userName });
  const messages = buildMessages(request, systemPrompt);

  if (typeof window !== "undefined") {
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      if (response.ok) return hideProviderNames(String((await response.json()).content || ""));
    } catch {
      // Keep chat usable when the server is unavailable.
    }
    return generateContextAwareResponse(request);
  }

  try {
    const response = await callProvider(messages);
    if (response) return hideProviderNames(response);
  } catch (error) {
    console.error("Nexa Intelligence request failed:", error);
  }
  return generateContextAwareResponse(request);
}

function generateContextAwareResponse(request: AIRequest): string {
  const lastUser = request.recentMessages.filter((message) => message.role === "user").pop()?.content || "";
  const lower = lastUser.toLowerCase();
  if (/weather|temperature|forecast|what time is it|capital of|joke|romantic message|love letter|homework|solve this equation/.test(lower)) {
    return "I'm focused on helping with your business and professional growth. I don't handle general or personal non-business queries here. What business challenge can I help you with?";
  }
  const biz = request.businessContext;
  const name = request.userName || biz?.name || "there";
  const business = biz?.businessName || "your business";
  if (request.workspace === "marketing" && /instagram|social media|content calendar|ad|campaign|seo|audience/.test(lower)) {
    return `Got it. Looking at ${business} in the Marketing workspace.\n\nBased on what I know about your focus${biz?.targetCustomer ? ` on ${biz.targetCustomer}` : ""}, here's how I'd approach this:\n\n1. Clarify the single most important acquisition channel right now.\n2. Define one clear offer/message for that channel.\n3. Run a tight 2-week experiment with clear success metrics.\n\nTell me more about the specific goal and I'll give you a concrete plan.`;
  }
  if (request.workspace === "sales" && /outreach|cold|dm|email|script|objection|follow.?up|close|funnel/.test(lower)) {
    return `In Sales mode for ${business}.\n\nI can help you write outreach sequences, handle objections, or improve conversion.\n\nTo make this specific: who are you reaching out to, what is the core offer, and what's the main friction you're seeing right now?`;
  }
  return `Understood, ${name}.\n\nI'm in the **${request.workspace.replace("_", " & ")}** workspace and I have your business context loaded${biz?.businessName ? ` for ${biz.businessName}` : ""}.\n\n${lastUser.length < 40 ? "Tell me more about what you're trying to achieve and any constraints." : "Here's how I recommend we approach this:"}\n\n- Restate the core problem clearly\n- Identify the highest-leverage next action\n- Give you something concrete you can execute this week\n\nWhat would be most useful right now — a plan, specific copy/messages, a decision framework, or a review of something you already have?`;
}

export async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    const response = await fetch("/api/fetch-website", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const data = await response.json();
    if (!response.ok) return `Could not fetch the website (${data.error || response.status}). Please paste the relevant content instead.`;
    return data.content || "No readable content extracted from the page.";
  } catch {
    return "Could not fetch the website. Please paste the relevant content instead.";
  }
}