/**
 * Nexa Browser AI Engine (lightweight fallback)
 * ------------------------------------------------
 * Heavy on-device models are disabled in production builds to avoid
 * Next.js bundling errors from CDN imports.
 *
 * Real AI responses should come from the server /api/chat route
 * using GROQ_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY.
 */

class NexaBrowserAI {
  constructor(options = {}) {
    this.systemPrompt = options.systemPrompt || "";
    this.isReady = false;
  }

  async loadModel() {
    this.isReady = true;
    return;
  }

  async sendMessage(_userMessage) {
    throw new Error(
      "Browser AI is not available. Please set GROQ_API_KEY (or GEMINI_API_KEY / OPENAI_API_KEY) in Vercel Environment Variables and redeploy."
    );
  }

  ready() {
    return this.isReady;
  }

  clearHistory() {}
  getHistory() {
    return [];
  }
}

export { NexaBrowserAI };
export default NexaBrowserAI;
