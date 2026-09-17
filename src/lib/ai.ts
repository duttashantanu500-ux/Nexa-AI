import { buildSystemPrompt } from "./prompts";
import {
  BusinessContext,
  Message,
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
  imageDataUrl?: string; // for vision later
  websiteContent?: string;
}

/**
 * Nexa Intelligence Provider Abstraction
 *
 * The user never sees the underlying model/provider.
 * This layer can be swapped later (Groq, OpenAI, Anthropic, local Ollama, etc.)
 * without changing the rest of the application.
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

  // Build messages for the model
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...request.recentMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  // If website content was fetched, append it to the last user message context
  if (request.websiteContent && messages.length > 1) {
    const last = messages[messages.length - 1];
    if (last.role === "user") {
      last.content += `\n\n[Website content provided for analysis]\n${request.websiteContent.slice(0, 12000)}`;
    }
  }

  // Note about image (vision models can use it; text models get a description prompt)
  if (request.imageDataUrl && messages.length > 1) {
    const last = messages[messages.length - 1];
    if (last.role === "user") {
      last.content += `\n\n[User attached an image. Please analyze it in the context of the current workspace and business goals. Describe what you see and give specific, actionable feedback.]`;
    }
  }

  // --------------------------------------------------
  // PROVIDER IMPLEMENTATION
  // --------------------------------------------------
  // 1. Prefer real API if key is present (OpenAI-compatible)
  // 2. Fallback to intelligent context-aware mock (so the product works immediately)

  const apiKey =
    typeof window !== "undefined"
      ? localStorage.getItem("nexa_openai_compatible_key")
      : null;
  const baseUrl =
    (typeof window !== "undefined"
      ? localStorage.getItem("nexa_openai_compatible_base")
      : null) || "https://api.groq.com/openai/v1";

  if (apiKey) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile", // good default on Groq; change as needed
          messages,
          temperature: 0.6,
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("AI provider error:", err);
        throw new Error("Provider error");
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || "I couldn't generate a response.";
    } catch (e) {
      console.error("Falling back to local intelligence", e);
      // fall through to mock
    }
  }

  // --------------------------------------------------
  // Intelligent local fallback (context-aware)
  // This makes the product usable and demonstrates the vision
  // without requiring an API key.
  // --------------------------------------------------
  return generateContextAwareResponse(request, systemPrompt);
}

function generateContextAwareResponse(
  request: AIRequest,
  systemPrompt: string
): string {
  const lastUser =
    request.recentMessages.filter((m) => m.role === "user").pop()
      ?.content || "";

  const lower = lastUser.toLowerCase();

  // Hard scope enforcement examples
  if (
    /weather|temperature|forecast|what time is it|capital of|joke|romantic message|love letter|homework|solve this equation/.test(
      lower
    )
  ) {
    return "I'm focused on helping with your business and professional growth. I don't handle general or personal non-business queries here. What business challenge can I help you with?";
  }

  const biz = request.businessContext;
  const name = request.userName || biz?.name || "there";
  const business = biz?.businessName || "your business";

  // Workspace-aware starter responses
  if (request.workspace === "marketing") {
    if (/instagram|social media|content calendar|ad|campaign|seo|audience/.test(lower)) {
      return `Got it. Looking at ${business} in the Marketing workspace.\n\nBased on what I know about your focus${biz?.targetCustomer ? ` on ${biz.targetCustomer}` : ""}, here's how I'd approach this:\n\n1. Clarify the single most important acquisition channel right now.\n2. Define one clear offer/message for that channel.\n3. Run a tight 2-week experiment with clear success metrics.\n\nTell me more about the specific goal (e.g. more leads, higher engagement, better conversion) and I'll give you a concrete plan.`;
    }
  }

  if (request.workspace === "sales") {
    if (/outreach|cold|dm|email|script|objection|follow.?up|close|funnel/.test(lower)) {
      return `In Sales mode for ${business}.\n\nI can help you write outreach sequences, handle objections, or improve conversion.\n\nTo make this specific: who are you reaching out to, what is the core offer, and what's the main friction you're seeing right now?`;
    }
  }

  if (request.workspace === "strategy") {
    if (/price|pricing|position|competitor|model|expand|priorit|decision/.test(lower)) {
      return `Strategy workspace — let's think this through carefully for ${business}.\n\nGood strategy starts with clarity on: target customer, unique value, and current constraints.\n\nShare more about the decision or problem you're facing and I'll help you structure it.`;
    }
  }

  if (request.workspace === "content_brand") {
    if (/post|caption|copy|landing|email|brand voice|content/.test(lower)) {
      return `Content & Brand for ${business}.\n\nI can draft posts, improve messaging, or help define a clearer brand voice.\n\nWhat do you need right now — a specific piece of copy, a content system, or a brand messaging review?`;
    }
  }

  if (request.workspace === "personal_growth") {
    return `Personal Growth (professional focus) for you as a ${request.userType.replace("_", " ")}.\n\nI can help with productivity systems, prioritization, founder mindset, and staying focused on what moves the business.\n\nWhat's the main friction in your work right now?`;
  }

  // Generic strong response using context
  return `Understood, ${name}.\n\nI'm in the **${request.workspace.replace("_", " & ")}** workspace and I have your business context loaded${biz?.businessName ? ` for ${biz.businessName}` : ""}.\n\n${lastUser.length < 40 ? "Tell me more about what you're trying to achieve and any constraints." : "Here's how I recommend we approach this:"}\n\n- Restate the core problem clearly\n- Identify the highest-leverage next action\n- Give you something concrete you can execute this week\n\nWhat would be most useful right now — a plan, specific copy/messages, a decision framework, or a review of something you already have?`;
}

/**
 * Fetch and extract website content via server route (avoids CORS, safer).
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
