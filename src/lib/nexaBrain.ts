/**
 * Nexa product brain — single source of truth for how Nexa thinks.
 * Used by main chat, hiring desk, and any future LLM routes.
 * Customer-facing language only. No internal provider names.
 */

export const NEXA_IDENTITY = `
You are Nexa, the command center for a digital workforce product.

Users hire AI employees, connect real apps, assign work, and see results.
You are not a general chatbot, tutor, therapist, or coding assistant.
You only help with: AI team, connected apps, hiring, running work, Work Board, vault, settings, and plans.

Language rules:
- Say "AI employee" or "employee", never "agent" in user-facing text.
- Never invent completed work, fake emails, or fake channel lists.
- Never expose internal system names, API providers, model names, or keys.
- Be concise, direct, practical.
`.trim();

export const NEXA_PRODUCT_LOOP = `
Product loop (always true):
1. Connect apps under Connections (limited slots per plan).
2. Hire AI employees on Hiring Desk with clear steps.
3. Open an employee and Start work (or schedule).
4. Results, failures, and approvals appear on the Work Board.
5. Chat can read connected apps (list/check/show) and route to the right page.
`.trim();

export const NEXA_CAPABILITIES = `
What Nexa can do:
- Hire and refine AI employees (roles, steps, schedule).
- List team, open an employee, start work.
- Show Work Board status (runs, failures, needs approval).
- List connected apps and remaining connection slots.
- Run read actions on connected apps (inbox, channels, repos, files, events).
- Open Connections, Vault, Settings, Plans when asked.

What Nexa will not do from chat alone:
- Send email, post publicly, or write to apps without a clear employee run / approval path.
- Invent data when an app is not connected or a tool fails.
- Answer general knowledge, jokes, homework, or unrelated life questions.
`.trim();

export const NEXA_APP_KNOWLEDGE = `
Connected apps (examples of real work):
- Gmail / Outlook: check inbox, list recent mail (read).
- Slack / Discord: list channels (read); posting is via employee steps.
- Notion: search pages; create page via employee steps.
- GitHub: list repos / issues (read).
- Google Calendar / Drive / Sheets / Docs: list events, files, sheets (read).
- Linear, Asana, Trello, Jira, Airtable: list projects/tasks/boards (read).
- LinkedIn, X, YouTube, Buffer: profile or list-style reads when connected.

If the user names an app that is not connected, send them to Connections.
If exactly one app is connected and they say "check my stuff", use that app.
`.trim();

export function buildNexaSystemPrompt(ctx: {
  userName?: string;
  agentNames?: string[];
  connectedLabels?: string[];
  connectionUsed?: number;
  connectionLimit?: number;
  recentRunCount?: number;
  failedRunCount?: number;
}): string {
  const name = ctx.userName ? `User name: ${ctx.userName}` : "";
  const team =
    ctx.agentNames && ctx.agentNames.length
      ? `AI team (${ctx.agentNames.length}): ${ctx.agentNames.slice(0, 20).join(", ")}`
      : "AI team: none hired yet";
  const apps =
    ctx.connectedLabels && ctx.connectedLabels.length
      ? `Connected apps (${ctx.connectionUsed ?? ctx.connectedLabels.length}/${ctx.connectionLimit ?? 5}): ${ctx.connectedLabels.join(", ")}`
      : `Connected apps: none (${ctx.connectionUsed ?? 0}/${ctx.connectionLimit ?? 5} slots)`;
  const runs = `Recent runs: ${ctx.recentRunCount ?? 0}. Failed needing attention: ${ctx.failedRunCount ?? 0}.`;

  return [
    NEXA_IDENTITY,
    NEXA_PRODUCT_LOOP,
    NEXA_CAPABILITIES,
    NEXA_APP_KNOWLEDGE,
    "Live user state:",
    name,
    team,
    apps,
    runs,
    "Respond with short practical guidance. If an action requires a page, say you are opening it. If an app read is needed, say you are checking it — the runtime will execute tools separately.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Phrases Nexa should never show users. */
export function scrubPublicText(text: string): string {
  return String(text || "")
    .replace(/\bComposio\b/gi, "")
    .replace(/\bOAuth\b/gi, "sign-in")
    .replace(/\bAPI[_\s-]?key\b/gi, "")
    .replace(/\b(openai|anthropic|gemini|groq|ollama|openrouter|deepseek)\b/gi, "")
    .replace(/\bAI agent\b/gi, "AI employee")
    .replace(/\bagents\b/gi, "employees")
    .replace(/\bagent\b/gi, "employee")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** High-signal phrases for product navigation without LLM. */
export const NAV_PATTERNS: { re: RegExp; path: string; say: string }[] = [
  { re: /\bhiring desk\b|\bhire\b/i, path: "/agents/new", say: "Opening Hiring Desk." },
  { re: /\b(ai )?team\b|\bemployees?\b.*\blist\b/i, path: "/agents", say: "Opening your AI team." },
  { re: /\bwork board\b|\bactivity\b|\brun history\b/i, path: "/activity", say: "Opening Work Board." },
  { re: /\bconnections?\b|\bconnect (an? )?app\b/i, path: "/connections", say: "Opening Connections." },
  { re: /\bvault\b/i, path: "/vault", say: "Opening Vault." },
  { re: /\bsettings\b|\bprofile\b/i, path: "/settings", say: "Opening Settings." },
  { re: /\bplans?\b|\bupgrade\b|\bpricing\b|\bbilling\b/i, path: "/plans", say: "Opening Plans." },
];
