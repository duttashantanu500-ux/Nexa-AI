/**
 * Nexa free browser AI fallback
 * Loads Transformers.js only in the browser at runtime.
 * Hard timeouts so the UI never stays stuck on "thinking".
 */

const MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";
const LOAD_TIMEOUT_MS = 12000;
const GEN_TIMEOUT_MS = 20000;

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label || "timeout")), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

async function loadTransformers() {
  if (typeof window === "undefined") {
    throw new Error("Browser only");
  }
  if (window.__nexaTransformers) return window.__nexaTransformers;

  const mod = await withTimeout(
    import(
      /* webpackIgnore: true */
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0"
    ),
    LOAD_TIMEOUT_MS,
    "transformers_import_timeout"
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
    this.loadFailed = false;
  }

  async loadModel() {
    if (this.isReady && this.generator) return;
    if (this.loadFailed) throw new Error("browser_model_unavailable");

    this.onProgress({
      status: "loading",
      progress: 0,
      message: "Loading free offline model...",
    });

    try {
      const { pipeline } = await loadTransformers();

      try {
        this.generator = await withTimeout(
          pipeline("text-generation", MODEL_ID, {
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
          }),
          LOAD_TIMEOUT_MS,
          "model_load_timeout"
        );
      } catch {
        this.generator = await withTimeout(
          pipeline("text-generation", MODEL_ID, {
            dtype: "q4",
            device: "wasm",
          }),
          LOAD_TIMEOUT_MS,
          "model_load_timeout"
        );
      }

      this.isReady = true;
      this.onProgress({ status: "ready", progress: 100, message: "Ready" });
    } catch (err) {
      this.loadFailed = true;
      this.isReady = false;
      this.generator = null;
      throw err;
    }
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
        ...this.history.slice(-8),
      ];

      const result = await withTimeout(
        this.generator(messages, {
          max_new_tokens: 180,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
        }),
        GEN_TIMEOUT_MS,
        "generation_timeout"
      );

      let full = "";
      if (Array.isArray(result)) {
        full = result[0]?.generated_text || "";
      } else if (typeof result === "string") {
        full = result;
      } else {
        full = result?.generated_text || String(result || "");
      }

      if (Array.isArray(full)) {
        const last = full[full.length - 1];
        full = typeof last === "object" ? last.content || "" : String(last || "");
      }

      full = this.cleanResponse(String(full), text);
      if (!full.trim()) {
        throw new Error("empty_browser_response");
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
