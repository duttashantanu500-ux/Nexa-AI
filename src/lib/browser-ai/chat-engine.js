/**
 * Nexa Browser AI Engine
 * -----------------------
 * Fully client-side AI chat engine using @huggingface/transformers
 * - Zero server cost
 * - Unlimited messages
 * - Runs entirely in the browser (WebGPU / WASM)
 * - No API keys required
 */

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.2";

// Configure Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

class NexaBrowserAI {
  constructor(options = {}) {
    this.modelId = options.modelId || "onnx-community/Qwen2.5-0.5B-Instruct";
    this.systemPrompt =
      options.systemPrompt ||
      "You are Nexa, a professional AI Business Growth Partner. You help founders, business owners, and agencies with marketing, sales, strategy, content, and professional growth. Be clear, practical, and actionable. Do not answer unrelated general knowledge questions.";
    this.maxHistory = options.maxHistory || 20;
    this.generator = null;
    this.isReady = false;
    this.isGenerating = false;
    this.history = this.loadHistory();
    this.onProgress = options.onProgress || (() => {});
    this.onToken = options.onToken || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || console.error;
  }

  /**
   * Load conversation history from localStorage
   */
  loadHistory() {
    try {
      const saved = localStorage.getItem("nexa_browser_chat_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save conversation history to localStorage
   */
  saveHistory() {
    try {
      localStorage.setItem(
        "nexa_browser_chat_history",
        JSON.stringify(this.history.slice(-this.maxHistory * 2))
      );
    } catch (err) {
      console.warn("Could not save chat history:", err);
    }
  }

  /**
   * Clear chat history
   */
  clearHistory() {
    this.history = [];
    localStorage.removeItem("nexa_browser_chat_history");
  }

  /**
   * Initialize and load the model
   */
  async loadModel() {
    if (this.isReady) return;

    try {
      this.onProgress({ status: "loading", progress: 0, message: "Starting model download..." });

      this.generator = await pipeline(
        "text-generation",
        this.modelId,
        {
          dtype: "q4", // quantized for better browser performance
          device: "webgpu", // will automatically fall back to WASM if WebGPU is unavailable
          progress_callback: (progress) => {
            if (progress.status === "progress") {
              const percent = progress.total
                ? Math.round((progress.loaded / progress.total) * 100)
                : 0;
              this.onProgress({
                status: "downloading",
                progress: percent,
                message: `Downloading model... ${percent}%`,
                file: progress.file,
              });
            } else if (progress.status === "done") {
              this.onProgress({
                status: "processing",
                progress: 100,
                message: "Processing model...",
              });
            }
          },
        }
      );

      this.isReady = true;
      this.onProgress({
        status: "ready",
        progress: 100,
        message: "Nexa Intelligence is ready",
      });
    } catch (err) {
      // Fallback to WASM if WebGPU fails
      console.warn("WebGPU failed, falling back to WASM:", err);

      try {
        this.generator = await pipeline(
          "text-generation",
          this.modelId,
          {
            dtype: "q4",
            device: "wasm",
            progress_callback: (progress) => {
              if (progress.status === "progress") {
                const percent = progress.total
                  ? Math.round((progress.loaded / progress.total) * 100)
                  : 0;
                this.onProgress({
                  status: "downloading",
                  progress: percent,
                  message: `Downloading model (WASM)... ${percent}%`,
                });
              }
            },
          }
        );

        this.isReady = true;
        this.onProgress({
          status: "ready",
          progress: 100,
          message: "Nexa Intelligence is ready (WASM)",
        });
      } catch (fallbackErr) {
        this.onError(fallbackErr);
        throw fallbackErr;
      }
    }
  }

  /**
   * Build the full messages array with system prompt
   */
  buildMessages(userMessage) {
    const messages = [
      { role: "system", content: this.systemPrompt },
      ...this.history.slice(-this.maxHistory),
      { role: "user", content: userMessage },
    ];
    return messages;
  }

  /**
   * Send a message and stream the response
   * @param {string} userMessage
   * @returns {Promise<string>} Full generated response
   */
  async sendMessage(userMessage) {
    if (!userMessage || !userMessage.trim()) {
      throw new Error("Message cannot be empty");
    }

    if (!this.isReady) {
      await this.loadModel();
    }

    if (this.isGenerating) {
      throw new Error("Already generating a response");
    }

    this.isGenerating = true;
    let fullResponse = "";

    try {
      // Add user message to history
      this.history.push({ role: "user", content: userMessage.trim() });

      const messages = this.buildMessages(userMessage.trim());

      // Generate with streaming
      const streamer = this.generator(messages, {
        max_new_tokens: 512,
        do_sample: true,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.1,
        streamer: {
          on_token: (token) => {
            // Note: transformers.js streaming support varies by version
            // We handle both streaming and non-streaming results
          },
        },
      });

      // Handle result (Transformers.js returns different formats)
      let result;
      if (streamer && typeof streamer.then === "function") {
        result = await streamer;
      } else {
        result = streamer;
      }

      // Extract generated text
      if (Array.isArray(result)) {
        fullResponse = result[0]?.generated_text || result[0] || "";
      } else if (typeof result === "string") {
        fullResponse = result;
      } else if (result?.generated_text) {
        fullResponse = result.generated_text;
      } else {
        fullResponse = String(result || "");
      }

      // Clean the response (remove the input prompt if it was echoed)
      fullResponse = this.cleanResponse(fullResponse, userMessage);

      // Simulate token streaming for better UX if real streaming isn't available
      if (fullResponse && this.onToken) {
        await this.simulateStreaming(fullResponse);
      }

      // Save assistant response to history
      this.history.push({ role: "assistant", content: fullResponse });
      this.saveHistory();

      this.onComplete(fullResponse);
      return fullResponse;
    } catch (err) {
      this.onError(err);
      throw err;
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Clean model output (remove echoed user message / system prompt)
   */
  cleanResponse(text, userMessage) {
    if (!text) return "";

    let cleaned = text;

    // Remove system prompt if present
    if (cleaned.includes(this.systemPrompt)) {
      cleaned = cleaned.split(this.systemPrompt).pop() || cleaned;
    }

    // Remove the user message if the model echoed it
    if (cleaned.includes(userMessage)) {
      const parts = cleaned.split(userMessage);
      cleaned = parts[parts.length - 1] || cleaned;
    }

    // Remove common role prefixes
    cleaned = cleaned
      .replace(/^(assistant|Assistant|AI|Nexa)\s*:\s*/i, "")
      .replace(/^system\s*:\s*/i, "")
      .trim();

    return cleaned;
  }

  /**
   * Simulate smooth token streaming for better UX
   */
  async simulateStreaming(text) {
    const words = text.split(/(\s+)/);
    let current = "";

    for (const word of words) {
      current += word;
      this.onToken(word, current);
      // Small delay for natural feel
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 30));
    }
  }

  /**
   * Get current history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Check if model is ready
   */
  ready() {
    return this.isReady;
  }
}

// Export for use
export { NexaBrowserAI };
export default NexaBrowserAI;
