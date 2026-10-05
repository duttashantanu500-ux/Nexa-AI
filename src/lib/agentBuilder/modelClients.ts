/**
 * Shared LLM HTTP clients for the AI Employee Builder.
 */

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

export async function callOpenAICompat(params: {
  baseUrl: string;
  model: string;
  apiKey: string;
  messages: { role: string; content: string }[];
  extraHeaders?: Record<string, string>;
  jsonMode?: boolean;
}): Promise<string | null> {
  const body: Record<string, unknown> = {
    model: params.model,
    temperature: 0.2,
    messages: params.messages,
  };
  if (params.jsonMode) {
    body.response_format = { type: "json_object" };
  }
  const res = await fetchWithTimeout(
    `${params.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
        ...(params.extraHeaders || {}),
      },
      body: JSON.stringify(body),
    },
    28000
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[agent-builder] provider HTTP", res.status, params.model, errText.slice(0, 200));
    // Retry once without json mode if provider rejected it
    if (params.jsonMode && (res.status === 400 || res.status === 404)) {
      return callOpenAICompat({ ...params, jsonMode: false });
    }
    return null;
  }
  const data = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function callGemini(params: {
  apiKey: string;
  model: string;
  system: string;
  messages: { role: string; content: string }[];
}): Promise<string | null> {
  const contents = params.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.system }] },
        contents,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
    28000
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[agent-builder] gemini HTTP", res.status, params.model, errText.slice(0, 200));
    return null;
  }
  const data = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim() || null;
}
