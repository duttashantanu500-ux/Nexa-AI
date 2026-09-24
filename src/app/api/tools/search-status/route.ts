import { NextResponse } from "next/server";

/**
 * Reports which search providers are configured (boolean only — no secrets).
 * Tries a minimal Gemini grounded call and returns the API error if any.
 */
export async function GET() {
  const gemini =
    Boolean(process.env.GEMINI_API_KEY?.trim()) ||
    Boolean(process.env.GOOGLE_API_KEY?.trim()) ||
    Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());

  const status = {
    geminiKeyPresent: gemini,
    braveKeyPresent: Boolean(
      process.env.BRAVE_API_KEY?.trim() || process.env.BRAVE_SEARCH_API_KEY?.trim()
    ),
    tavilyKeyPresent: Boolean(process.env.TAVILY_API_KEY?.trim()),
    serperKeyPresent: Boolean(process.env.SERPER_API_KEY?.trim()),
    geminiProbe: null as null | { ok: boolean; model?: string; detail?: string; hitCount?: number },
  };

  if (gemini) {
    const key =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      "";

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let lastErr = "";

    for (const model of models) {
      try {
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
          encodeURIComponent(key);

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: 'Search the web for "Lucknow restaurants". Return JSON array of {title,url,snippet}.',
                  },
                ],
              },
            ],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
          }),
          signal: AbortSignal.timeout(20000),
        });

        const body = await res.text();
        if (!res.ok) {
          lastErr = `${model}: HTTP ${res.status} ${body.slice(0, 200)}`;
          continue;
        }

        let data: any;
        try {
          data = JSON.parse(body);
        } catch {
          lastErr = `${model}: non-JSON response`;
          continue;
        }

        const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const text =
          data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";

        status.geminiProbe = {
          ok: true,
          model,
          hitCount: chunks.length,
          detail:
            chunks.length > 0
              ? `Grounding returned ${chunks.length} chunks`
              : text
                ? `Model responded (${text.slice(0, 80)}…) but no groundingChunks`
                : "Empty candidate",
        };
        break;
      } catch (e: any) {
        lastErr = `${model}: ${e?.message || "failed"}`;
      }
    }

    if (!status.geminiProbe) {
      status.geminiProbe = {
        ok: false,
        detail: lastErr || "All Gemini models failed",
      };
    }
  }

  return NextResponse.json(status);
}
