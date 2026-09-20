/**
 * Nexa free browser AI fallback
 * Loads Transformers.js only in the browser at runtime (not bundled by Next.js).
 */

const MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";

async function loadTransformers() {
  if (typeof window === "undefined") {
    throw new Error("Browser only");
  }
  if (window.__nexaTransformers) return window.__nexaTransformers;

  const mod = await import(
    /* webpackIgnore: true */
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0"
  );

  if (mod.env) {
    mod.env.allowLocalModels = false;
    mod.env.useBrowserCache = true;
  }

  window.__nexaTransformers = mod;
  return mod;
}

class NexaBrowserAI {
  constructor(options = {}) {
    this.systemPrompt =
      options.systemPrompt ||
      "You are Nexa, a practical AI business growth partner for founders, business owners, and agencies. Write in plain natural language. Keep punctuation light. Be useful and specific.";
    this.generator = null;
    this.isReady = false;
    this.isGenerating = false;
    this.history = [];
    this.onProgress = options.onProgress || (() => {});
  }

  async loadModel() {
    if (this.isReady && this.generator) return;

    this.onProgress({ status: "loading", progress: 0, message: "Loading free offline model..." });

    const { pipeline } = await loadTransformers();

    try {
      this.generator = await pipeline("text-generation", MODEL_ID, {
        dtype: "q4",
        device: "webgpu",
        progress_callback: (p) => {
          if (p.status === "progress" && p.total) {
            const percent = Math.round((p.loaded / p.total) * 100);
            this.onProgress({
              status: "downloading",
              progress: percent,
              message: `Downloading free model... ${percent}%`,
            });
          }
        },
      });
    } catch {
      this.generator = await pipeline("text-generation", MODEL_ID, {
        dtype: "q4",
        device: "wasm",
        progress_callback: (p) => {
          if (p.status === "progress" && p.total) {
            const percent = Math.round((p.loaded / p.total) * 100);
            this.onProgress({
              status: "downloading",
              progress: percent,
              message: `Downloading free model... ${percent}%`,
            });
          }
        },
      });
    }

    this.isReady = true;
    this.onProgress({ status: "ready", progress: 100, message: "Ready" });
  }

  async sendMessage(userMessage) {
    const text = (userMessage || "").trim();
    if (!text) throw new Error("Empty message");

    if (!this.isReady) await this.loadModel();
    if (this.isGenerating) throw new Error("Busy");

    this.isGenerating = true;

    try {
      this.history.push({ role: "user", content: text });

      const messages = [
        { role: "system", content: this.systemPrompt },
        ...this.history.slice(-12),
      ];

      const result = await this.generator(messages, {
        max_new_tokens: 256,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
      });

      let full = "";
      if (Array.isArray(result)) {
        full = result[0]?.generated_text || "";
      } else if (typeof result === "string") {
        full = result;
      } else {
        full = result?.generated_text || String(result || "");
      }

      if (Array.isArray(full)) {
        // chat template style: array of messages
        const last = full[full.length - 1];
        full = typeof last === "object" ? last.content || "" : String(last || "");
      }

      full = this.cleanResponse(String(full), text);
      if (!full.trim()) {
        full =
          "I am using the free offline mode right now and could not finish that answer. Try again in a moment or rephrase your question.";
      }

      this.history.push({ role: "assistant", content: full });
      return full;
    } finally {
      this.isGenerating = false;
    }
  }

  cleanResponse(text, userMessage) {
    let cleaned = text || "";

    if (cleaned.includes(this.systemPrompt)) {
      cleaned = cleaned.split(this.systemPrompt).pop() || cleaned;
    }
    if (userMessage && cleaned.includes(userMessage)) {
      const parts = cleaned.split(userMessage);
      cleaned = parts[parts.length - 1] || cleaned;
    }

    cleaned = cleaned
      .replace(/^(assistant|Assistant|AI|Nexa|system)\s*:\s*/i, "")
      .replace(/^(user)\s*:\s*/i, "")
      .trim();

    return cleaned;
  }

  ready() {
    return this.isReady;
  }

  clearHistory() {
    this.history = [];
  }

  getHistory() {
    return [...this.history];
  }
}

export { NexaBrowserAI };
export default NexaBrowserAI;
