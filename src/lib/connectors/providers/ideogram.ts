/**
 * Ideogram official API (per-user Api-Key).
 * Docs: https://developer.ideogram.ai
 */

import type { NormalizedProviderError } from "@/types";

const BASE = "https://api.ideogram.ai";

export type IdeogramActionResult = {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: NormalizedProviderError;
};

/** Validate key without spending generation credits when possible. */
export async function ideogramVerifyKey(apiKey: string): Promise<IdeogramActionResult> {
  try {
    const res = await fetch(`${BASE}/v1/ideogram-v4/generate`, {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text_prompt: "" }),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message: "This Ideogram access key was not accepted. Check the key and try again.",
        error: { category: "auth", providerStatusCode: res.status },
      };
    }
    if (res.status === 400 || res.ok) {
      return { ok: true, message: "Your Ideogram access is working." };
    }
    if (res.status === 429) {
      return {
        ok: false,
        message: "Ideogram is rate-limiting this key right now. Try again in a moment.",
        error: { category: "rate_limit", providerStatusCode: 429 },
      };
    }
    return {
      ok: false,
      message: "Could not verify Ideogram access right now.",
      error: { category: "server_error", providerStatusCode: res.status },
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach Ideogram. Check your network and try again.",
      error: { category: "server_error" },
    };
  }
}

const ASPECT_MAP: Record<string, string> = {
  "1:1": "1x1",
  "1x1": "1x1",
  "16:9": "16x9",
  "16x9": "16x9",
  "9:16": "9x16",
  "9x16": "9x16",
  "4:3": "4x3",
  "4x3": "4x3",
  "3:4": "3x4",
  "3x4": "3x4",
  "3:2": "3x2",
  "3x2": "3x2",
  "2:3": "2x3",
  "2x3": "2x3",
};

const SPEED_MAP: Record<string, string> = {
  flash: "FLASH",
  turbo: "TURBO",
  default: "DEFAULT",
  quality: "QUALITY",
  fast: "TURBO",
  balanced: "DEFAULT",
  high: "QUALITY",
};

export async function ideogramGenerateImage(params: {
  apiKey: string;
  prompt: string;
  aspectRatio?: string;
  renderingSpeed?: string;
  numImages?: number;
  negativePrompt?: string;
  seed?: number;
}): Promise<IdeogramActionResult> {
  const prompt = (params.prompt || "").trim();
  if (!prompt) {
    return {
      ok: false,
      message: "Please provide a prompt describing the image.",
      error: { category: "validation" },
    };
  }

  const body: Record<string, unknown> = {
    text_prompt: prompt,
  };

  const ar = (params.aspectRatio || "").trim();
  if (ar) {
    body.aspect_ratio = ASPECT_MAP[ar] || ASPECT_MAP[ar.replace(":", "x")] || ar;
  }

  const speed = (params.renderingSpeed || "").trim().toLowerCase();
  if (speed && SPEED_MAP[speed]) {
    body.rendering_speed = SPEED_MAP[speed];
  } else if (params.renderingSpeed?.trim()) {
    body.rendering_speed = params.renderingSpeed.trim().toUpperCase();
  }

  const n = params.numImages ?? 1;
  if (n >= 1 && n <= 8) body.num_images = n;

  if (params.negativePrompt?.trim()) {
    body.negative_prompt = params.negativePrompt.trim();
  }

  if (typeof params.seed === "number" && params.seed >= 0) {
    body.seed = Math.floor(params.seed);
  }

  try {
    const res = await fetch(`${BASE}/v1/ideogram-v4/generate`, {
      method: "POST",
      headers: {
        "Api-Key": params.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message: "Your Ideogram access is no longer valid. Reconnect under Connections.",
        error: { category: "auth", providerStatusCode: res.status },
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        message: "Ideogram rate limit reached. Please try again shortly.",
        error: { category: "rate_limit", providerStatusCode: 429 },
      };
    }
    if (res.status === 402) {
      return {
        ok: false,
        message: "Your Ideogram account does not have enough access for this request.",
        error: { category: "auth", providerStatusCode: 402 },
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: "Ideogram could not create the image. Adjust the prompt and try again.",
        error: {
          category: res.status >= 500 ? "server_error" : "validation",
          providerStatusCode: res.status,
        },
      };
    }

    const data = Array.isArray(json.data) ? json.data : [];
    if (!data.length) {
      return {
        ok: false,
        message: "Ideogram did not return an image.",
        error: { category: "server_error" },
      };
    }

    const images = data
      .map((item: Record<string, unknown>) => ({
        url: String(item.url || ""),
        prompt: String(item.prompt || prompt),
        resolution: item.resolution ? String(item.resolution) : undefined,
        seed: typeof item.seed === "number" ? item.seed : undefined,
        isSafe: item.is_image_safe !== false,
      }))
      .filter((i: { url: string }) => i.url);

    if (!images.length) {
      return {
        ok: false,
        message: "Ideogram did not return a usable image link.",
        error: { category: "server_error" },
      };
    }

    return {
      ok: true,
      message:
        images.length === 1
          ? "Image created successfully."
          : `${images.length} images created successfully.`,
      data: {
        images,
        imageUrl: images[0].url,
        created: json.created,
      },
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach Ideogram. Please try again.",
      error: { category: "server_error" },
    };
  }
}
