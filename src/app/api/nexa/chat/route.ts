import { NextRequest, NextResponse } from "next/server";
import { buildNexaSystemPrompt, scrubPublicText } from "@/lib/nexaBrain";
import { callOpenAICompat, callGemini, callOllama } from "@/lib/agentBuilder/modelClients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

function getApiKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = process.env[name];
    if (raw && raw.trim()) return raw.trim();
  }
  return null;
}

/**
 * POST /api/nexa/chat
 * Grounded conversational help for Nexa product questions.
 * Does NOT execute tools — caller handles app operations.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Empty message" },
        { status: 400 }
      );
    }

    const system = buildNexaSystemPrompt({
      userName: body.userName ? String(body.userName) : undefined,
      agentNames: Array.isArray(body.agentNames) ? body.agentNames.map(String) : [],
      connectedLabels: Array.isArray(body.connectedLabels)
        ? body.connectedLabels.map(String)
        : [],
      connectionUsed: Number(body.connectionUsed) || 0,
      connectionLimit: Number(body.connectionLimit) || 5,
      recentRunCount: Number(body.recentRunCount) || 0,
      failedRunCount: Number(body.failedRunCount) || 0,
    });

    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (m: { role?: string; content?: string }) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-6)
          .map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: String(m.content).slice(0, 2000),
          }))
      : [];

    const messages = [
      { role: "system" as const, content: system },
      ...history,
      { role: "user" as const, content: message.slice(0, 2000) },
    ];

    const geminiKey = getApiKey(
      "GEMINI_API_KEY",
      "GOOGLE_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY"
    );
    const groqKey = getApiKey("GROQ_API_KEY");
    const openaiKey = getApiKey("OPENAI_API_KEY");
    const deepseekKey = getApiKey("DEEPSEEK_API_KEY");
    const openrouterKey = getApiKey("OPENROUTER_API_KEY");
    const ollamaKey = getApiKey("OLLAMA_API_KEY");

    type Attempt = () => Promise<string | null>;
    const attempts: Attempt[] = [];

    if (groqKey) {
      attempts.push(async () =>
        callOpenAICompat({
          baseUrl: "https://api.groq.com/openai/v1",
          model: "llama-3.1-8b-instant",
          apiKey: groqKey,
          messages,
          jsonMode: false,
        })
      );
    }
    if (geminiKey) {
      attempts.push(async () =>
        callGemini({
          apiKey: geminiKey,
          model: "gemini-2.0-flash",
          system,
          messages: [...history, { role: "user", content: message }],
        })
      );
    }
    if (openaiKey) {
      attempts.push(async () =>
        callOpenAICompat({
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
          apiKey: openaiKey,
          messages,
          jsonMode: false,
        })
      );
    }
    if (deepseekKey) {
      attempts.push(async () =>
        callOpenAICompat({
          baseUrl: "https://api.deepseek.com",
          model: "deepseek-chat",
          apiKey: deepseekKey,
          messages,
          jsonMode: false,
        })
      );
    }
    if (openrouterKey) {
      attempts.push(async () =>
        callOpenAICompat({
          baseUrl: "https://openrouter.ai/api/v1",
          model: "google/gemini-2.5-flash",
          apiKey: openrouterKey,
          messages,
          jsonMode: false,
          extraHeaders: {
            "HTTP-Referer":
              process.env.NEXT_PUBLIC_APP_URL ||
              "https://www.nexaiintelligence.online",
            "X-Title": "Nexa",
          },
        })
      );
    }
    if (ollamaKey) {
      const base = (
        process.env.OLLAMA_API_BASE ||
        process.env.OLLAMA_HOST ||
        "https://ollama.com/api"
      ).replace(/\/$/, "");
      attempts.push(async () =>
        callOllama({
          baseUrl: base,
          model: (process.env.OLLAMA_MODEL || "gpt-oss:20b").split(",")[0].trim(),
          apiKey: ollamaKey,
          messages,
          jsonFormat: false,
        })
      );
    }

    for (const attempt of attempts) {
      try {
        const text = await attempt();
        if (text && text.trim().length > 8) {
          return NextResponse.json({
            ok: true,
            message: scrubPublicText(text).slice(0, 2500),
          });
        }
      } catch {
        /* next */
      }
    }

    // Deterministic grounded fallback when no model answers
    const labels: string[] = Array.isArray(body.connectedLabels)
      ? body.connectedLabels.map(String)
      : [];
    const agents: string[] = Array.isArray(body.agentNames)
      ? body.agentNames.map(String)
      : [];
    let fallback =
      "I help with your AI team, connected apps, hiring, and Work Board. ";
    if (labels[0]) fallback += `Try “check ${labels[0]}”. `;
    if (agents[0]) fallback += `Or open “${agents[0]}”. `;
    fallback += "Say list my team, what’s connected, or hire an employee.";

    return NextResponse.json({ ok: true, message: fallback, fallback: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Chat unavailable" },
      { status: 500 }
    );
  }
}
