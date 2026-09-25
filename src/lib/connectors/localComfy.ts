/**
 * Local ComfyUI / compatible image server client.
 * Credentials = user-configured base URL only (no Nexa-owned API key).
 */

export interface ComfyConfig {
  baseUrl: string;
}

export async function testComfyConnection(
  baseUrl: string
): Promise<{ ok: boolean; message: string }> {
  const root = normalizeBase(baseUrl);
  if (!root) return { ok: false, message: "Enter a local endpoint URL (e.g. http://127.0.0.1:8188)" };

  try {
    // Common ComfyUI system stats / root
    const res = await fetch(`${root}/system_stats`, {
      signal: AbortSignal.timeout(8000),
    }).catch(async () => {
      return fetch(root, { signal: AbortSignal.timeout(8000) });
    });

    if (!res.ok && res.status !== 404) {
      return { ok: false, message: `Endpoint responded with HTTP ${res.status}` };
    }
    return { ok: true, message: `Reachable at ${root}` };
  } catch (e: any) {
    return {
      ok: false,
      message:
        e?.message?.includes("fetch") || e?.name === "TypeError"
          ? "Cannot reach local server. Is ComfyUI running? Browser may block mixed content / CORS."
          : e?.message || "Connection failed",
    };
  }
}

/**
 * Minimal text-to-image via ComfyUI prompt API.
 * Uses a simple workflow JSON; users with custom graphs may need to adapt.
 * Returns image URL on the local server or fails honestly.
 */
export async function generateWithComfy(params: {
  baseUrl: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
}): Promise<{ ok: boolean; imageUrl?: string; error?: string; raw?: unknown }> {
  const root = normalizeBase(params.baseUrl);
  if (!root) return { ok: false, error: "ComfyUI endpoint not configured" };
  if (!params.prompt.trim()) return { ok: false, error: "Prompt is required" };

  const width = params.width || 512;
  const height = params.height || 512;
  const seed =
    params.seed != null && params.seed >= 0
      ? params.seed
      : Math.floor(Math.random() * 1e9);

  // Minimal SD1.5-style graph (works on default ComfyUI installs with ckpt)
  const workflow = {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 20,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "v1-5-pruned-emaonly.safetensors" },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: params.prompt, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: params.negativePrompt || "",
        clip: ["4", 1],
      },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "nexa", images: ["8", 0] },
    },
  };

  try {
    const promptRes = await fetch(`${root}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
      signal: AbortSignal.timeout(30000),
    });

    if (!promptRes.ok) {
      const t = await promptRes.text().catch(() => "");
      return {
        ok: false,
        error: `ComfyUI rejected the job (HTTP ${promptRes.status}). ${t.slice(0, 200)} Check model name and that ComfyUI is running.`,
      };
    }

    const promptData = await promptRes.json();
    const promptId = promptData.prompt_id;
    if (!promptId) {
      return { ok: false, error: "ComfyUI did not return a prompt_id" };
    }

    // Poll history
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const histRes = await fetch(`${root}/history/${promptId}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!histRes.ok) continue;
      const hist = await histRes.json();
      const entry = hist[promptId];
      if (!entry) continue;

      const outputs = entry.outputs || {};
      for (const nodeId of Object.keys(outputs)) {
        const images = outputs[nodeId]?.images;
        if (images?.[0]) {
          const img = images[0];
          const filename = img.filename;
          const subfolder = img.subfolder || "";
          const type = img.type || "output";
          const imageUrl = `${root}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
          return { ok: true, imageUrl, raw: { promptId, filename } };
        }
      }

      if (entry.status?.status_str === "error") {
        return { ok: false, error: "ComfyUI reported an error for this job" };
      }
    }

    return { ok: false, error: "Timed out waiting for ComfyUI result" };
  } catch (e: any) {
    return {
      ok: false,
      error:
        e?.message ||
        "Failed to reach ComfyUI. Ensure it is running and CORS allows this site (or use a local tunnel).",
    };
  }
}

function normalizeBase(url: string) {
  return (url || "").trim().replace(/\/$/, "");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
