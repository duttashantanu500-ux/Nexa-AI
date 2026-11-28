/**
 * Nexa product brain — single source of truth for how Nexa thinks.
 * Used by main chat, hiring desk, and grounded chat API.
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
- Be concise, direct, practical. Prefer next actions over essays.
`.trim();

export const NEXA_PRODUCT_LOOP = `
Product loop (always true):
1. Connect apps under Connections (limited slots per plan).
2. Hire AI employees on Hiring Desk with clear steps.
3. Open an employee and Start work (or enable a schedule).
4. Results, failures, and approvals appear on the Work Board.
5. Chat can read connected apps (list/check/show) and route to the right page.

Empty Work Board usually means no runs yet — not a bug. User must Start work on an employee.
`.trim();

export const NEXA_CAPABILITIES = `
What Nexa can do:
- Hire and refine AI employees (roles, steps, schedule).
- List team, open an employee, start work.
- Show Work Board status (runs, failures, needs approval).
- List connected apps and remaining connection slots.
- Run read actions on connected apps (inbox, channels, repos, files, events).
- Open Connections, Vault, Settings, Plans when asked.
- Explain why a step needs an app connected or a channel/page picked.

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
Generic "inbox" → Gmail if connected, else Outlook.
Generic "calendar" → Google Calendar if connected.
Generic "files" → Google Drive if connected, else Notion search.
`.trim();

export const NEXA_ROLE_TEMPLATES = `
Common AI employee roles to propose when hiring:
- Research employee: capture notes → write summary report → optional Notion page.
- Inbox helper: summarize inbox themes (needs Gmail/Outlook connected for live reads).
- Slack ops: post team updates to a chosen channel (needs Slack + channel).
- Notion writer: create structured pages under a parent the user picks.
- GitHub watcher: list repos / surface issues (read).
- Daily brief: local notes + report on a daily schedule; add Slack/Notion when connected.

Always prefer fewest steps. Prefer registry actions that can actually run.
Schedules: once (manual), daily, weekly, monthly only.
`.trim();

export const NEXA_RECOVERY = `
When something fails or is empty:
- No connections → open Connections; explain slot limit briefly.
- App not connected → name the app and open Connections.
- No employees → open Hiring Desk with a concrete role suggestion.
- No runs on Work Board → tell user to open an employee and Start work.
- Tool error → soft message, never dump stack traces or provider names.
- Write action requested in chat → say employee run / approval is the safe path.
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
    NEXA_ROLE_TEMPLATES,
    NEXA_RECOVERY,
    "Live user state:",
    name,
    team,
    apps,
    runs,
    "Respond with short practical guidance. If an action requires a page, say you are opening it. If an app read is needed, say you are checking it — the runtime will execute tools separately. Offer one clear next step.",
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

/** Suggested chips for empty chat (UI optional). */
export function chatSuggestions(ctx: {
  connectedLabels?: string[];
  agentNames?: string[];
}): string[] {
  const out: string[] = [];
  if (ctx.connectedLabels?.[0]) out.push(`Check ${ctx.connectedLabels[0]}`);
  if (ctx.agentNames?.[0]) out.push(`Open ${ctx.agentNames[0]}`);
  out.push("What's connected", "List my team", "Hire a research employee", "Work board");
  return out.slice(0, 5);
}
