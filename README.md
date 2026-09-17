# Nexa — AI Business Growth Partner

Nexa is a focused AI workspace built specifically for **Founders**, **Business Owners**, and **Agencies**.

It is **not** a general-purpose chatbot.

## Core Workspaces

1. **Marketing** — acquisition, campaigns, SEO, social, positioning
2. **Sales** — outreach, messaging, funnels, closing
3. **Strategy** — business models, pricing, prioritization, decisions
4. **Content & Brand** — posts, copy, brand voice, content systems
5. **Personal Growth** — productivity, founder mindset, professional focus

## Features

- User-type restricted onboarding (Founder / Business Owner / Agency only)
- Tailored onboarding questions per type
- Shared long-term business memory
- Separate conversation history per workspace
- Workspace-specific AI behavior and system prompts
- Guardrails against general / non-business questions
- Wrong-workspace redirection suggestions
- Automatic conversation titles
- Duplicate message prevention
- No repeated greetings
- Minimal Settings (Profile + Appearance + Logout)
- Clean, professional interface (Claude / ChatGPT inspired principles)
- No voice functionality

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- LocalStorage for persistence in this version (easy to migrate to Supabase later)
- Provider-agnostic AI layer ("Nexa Intelligence")

## Getting Started

```bash
cd nexa
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Optional: Connect a real AI provider

In the browser console (or we can add a settings field later):

```js
localStorage.setItem("nexa_openai_compatible_key", "YOUR_API_KEY")
localStorage.setItem("nexa_openai_compatible_base", "https://api.groq.com/openai/v1") // or OpenAI, etc.
```

Without a key, Nexa uses a context-aware intelligent fallback so you can still experience the full product.

## Project Structure

```
src/
  app/
    page.tsx          → router
    signup/           → email signup
    login/            → email login
    onboarding/       → user type + tailored questions
    chat/             → main workspace + conversations
    settings/         → minimal settings
  components/
  lib/
    ai.ts             → Nexa Intelligence abstraction
    prompts.ts        → core + workspace system prompts
    storage.ts        → persistence helpers
    utils.ts
  types/
    index.ts
```

## Product Principles

- Focused on business growth only
- Shared memory, separated conversations
- One user message → one AI request → one assistant message
- No automatic greetings on load / refresh / workspace switch
- Professional, fast, minimal interface

---

Built according to the Nexa Master Product Update specification.
