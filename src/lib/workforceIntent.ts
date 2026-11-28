/**
 * Main Nexa chat — trained command understanding for the digital workforce.
 * Deterministic, high coverage. Never invents tool results or completed work.
 */

export type WorkforceIntent =
  | "chat"
  | "hire"
  | "list_team"
  | "work_status"
  | "run_employee"
  | "connections"
  | "list_connected"
  | "app_operation"
  | "configure_hint"
  | "capabilities"
  | "vault"
  | "settings"
  | "plans"
  | "refuse"
  | "clarify"
  | "unsupported";

export type WorkforceContext = {
  userName?: string;
  agentNames: string[];
  agentIdsByName: Record<string, string>;
  recentRunCount?: number;
  failedRunCount?: number;
  connectedLabels?: string[];
  connectedSlugs?: string[];
  connectionUsed?: number;
  connectionLimit?: number;
};

export type WorkforceResult = {
  intent: WorkforceIntent;
  message: string;
  navigateTo?: string;
  hireHint?: string;
  agentId?: string;
  useModel?: boolean;
  toolkit?: string;
  toolSlug?: string;
  toolArgs?: Record<string, unknown>;
};

const REFUSE =
  /\b(hack|steal|bypass password|credit card|ssn|wire transfer|malware|ransomware|illegal|phishing)\b/i;

const HIRE =
  /\b(hire|create|build|make|set up|setup|need|want|add)\b.*\b(employee|assistant|role|worker|teammate|member)\b|\b(new employee|hiring desk)\b|\b(employee)\b.*\b(for|that|to|who)\b/i;

const LIST_TEAM =
  /\b(list (my )?(team|employees)|who (do i|have i) (hired|got)|show (me )?(my )?(team|employees)|my (ai )?team|who is on (my )?(team|staff)|how many employees)\b/i;

const STATUS =
  /\b(what (did|have) (my )?(employees?|team) (do|done|accomplish)|work (board|history|status)|failed runs?|needs attention|today'?s (work|results?)|any (failures?|errors?)|run history)\b/i;

const LIST_CONNECTED =
  /\b(what('?s| is| are)? (my )?(connected|linked) (apps?|accounts?|tools?)|which apps? (are )?(connected|linked)|show (my )?connections?|list (my )?(connected )?apps?|am i connected)\b/i;

const CONNECTIONS_NAV =
  /\b(open connections?|manage connections?|go to connections?|connect (an? )?app|link (an? )?app)\b/i;

const CAPABILITIES =
  /\b(what can you do|what do you do|how (do|can) (i|you)|help me|capabilities|what (apps?|tools?) (can|do) you|how does (this|nexa) work)\b/i;

const APP_OP =
  /\b(check|fetch|get|list|read|show|summarize|send|post|create|find|search|open|look( at)?|pull|scan|review|browse)\b/i;

const VAULT = /\b(vault|files? in vault|my files|uploaded files)\b/i;
const SETTINGS = /\b(settings|account settings|my account|profile)\b/i;
const PLANS = /\b(upgrade|pricing|plans?|subscription|pro plan|billing)\b/i;

const KNOWN_TOOLKITS: { re: RegExp; slug: string }[] = [
  { re: /\bgmail\b|\binbox\b(?!.*outlook)|\bunread (mail|email)/i, slug: "gmail" },
  { re: /\boutlook\b/i, slug: "outlook" },
  { re: /\bslack\b/i, slug: "slack" },
  { re: /\bnotion\b/i, slug: "notion" },
  { re: /\bgithub\b|\brepos?\b|\brepositories\b/i, slug: "github" },
  { re: /\bgoogle drive\b|\bgdrive\b|\bdrive files?\b/i, slug: "googledrive" },
  { re: /\bgoogle calendar\b|\bmy calendar\b|\bupcoming events?\b/i, slug: "googlecalendar" },
  { re: /\bgoogle sheets?\b|\bspreadsheets?\b/i, slug: "googlesheets" },
  { re: /\bgoogle docs?\b/i, slug: "googledocs" },
  { re: /\bdiscord\b/i, slug: "discord" },
  { re: /\blinear\b/i, slug: "linear" },
  { re: /\basana\b/i, slug: "asana" },
  { re: /\btrello\b/i, slug: "trello" },
  { re: /\bjira\b/i, slug: "jira" },
  { re: /\btwitter\b|\btweet|\b\bx\b (timeline|posts?)/i, slug: "twitter" },
  { re: /\blinkedin\b/i, slug: "linkedin" },
  { re: /\bairtable\b/i, slug: "airtable" },
  { re: /\byoutube\b/i, slug: "youtube" },
  { re: /\bemail\b|\bmails?\b/i, slug: "gmail" },
];

function inferToolkitFromContext(
  t: string,
  connectedSlugs?: string[]
): string | undefined {
  const lower = t.toLowerCase();
  const connected = (connectedSlugs || []).map((s) => s.toLowerCase());
  const has = (slug: string) => connected.includes(slug);

  if (/\binbox\b|\bunread\b|\bemail\b|\bmails?\b/.test(lower)) {
    if (has("gmail")) return "gmail";
    if (has("outlook")) return "outlook";
  }
  if (/\bcalendar\b|\bmeetings?\b|\bevents?\b/.test(lower)) {
    if (has("googlecalendar")) return "googlecalendar";
    if (has("outlook")) return "outlook";
  }
  if (/\bfiles?\b|\bdrive\b|\bdocuments?\b/.test(lower)) {
    if (has("googledrive")) return "googledrive";
    if (has("notion")) return "notion";
  }
  if (/\bchannels?\b|\bworkspace\b/.test(lower) && has("slack")) return "slack";
  if (/\brepos?\b|\bpull requests?\b|\bissues?\b/.test(lower) && has("github"))
    return "github";
  return undefined;
}

export function detectToolkit(
  t: string,
  connectedSlugs?: string[]
): string | undefined {
  const lower = t.toLowerCase();
  for (const { re, slug } of KNOWN_TOOLKITS) {
    if (re.test(lower)) return slug;
  }
  const inferred = inferToolkitFromContext(t, connectedSlugs);
  if (inferred) return inferred;
  if (connectedSlugs?.length) {
    for (const slug of connectedSlugs) {
      const s = slug.toLowerCase();
      if (s && lower.includes(s)) return s;
      const spaced = s.replace(/[_-]+/g, " ");
      if (spaced.length > 2 && lower.includes(spaced)) return s;
    }
  }
  return undefined;
}

function findAgentId(text: string, ctx: WorkforceContext): string | undefined {
  const lower = text.toLowerCase();
  const entries = Object.entries(ctx.agentIdsByName || {}).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [name, id] of entries) {
    if (name && lower.includes(name.toLowerCase())) return id;
  }
  return undefined;
}

function extractSearchQuery(text: string): string {
  const m =
    text.match(
      /\b(?:search|find|look up|query)\s+(?:for\s+)?["']?([^"'\n]{2,80})/i
    ) || text.match(/\b(?:about|regarding)\s+([^\n]{2,80})/i);
  return m ? m[1].trim() : "";
}

export function classifyWorkforceMessage(
  text: string,
  ctx: WorkforceContext
): WorkforceResult {
  const t = (text || "").trim();
  const name = ctx.userName ? `, ${ctx.userName}` : "";
  const labels = ctx.connectedLabels || [];
  const used = ctx.connectionUsed ?? labels.length;
  const limit = ctx.connectionLimit ?? 5;
  const slugs = (ctx.connectedSlugs || []).map((s) => s.toLowerCase());

  if (!t) {
    return { intent: "clarify", message: `What do you need${name}?` };
  }

  if (REFUSE.test(t)) {
    return { intent: "refuse", message: "I can’t help with that." };
  }

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))[\s!.]*$/i.test(t)) {
    const apps =
      labels.length > 0
        ? ` ${labels.slice(0, 5).join(", ")} connected.`
        : "";
    const team =
      ctx.agentNames.length > 0
        ? ` ${ctx.agentNames.length} on your team.`
        : "";
    return {
      intent: "chat",
      message: `Hi${name}.${apps}${team} Ask me to check an app, list your team, hire someone, or open the Work Board.`,
    };
  }

  if (CAPABILITIES.test(t) || /\bwhat can nexa do\b/i.test(t)) {
    const apps =
      labels.length > 0
        ? `Connected (${used}/${limit}): ${labels.join(", ")}.`
        : `No apps connected (${used}/${limit} slots).`;
    const team =
      ctx.agentNames.length > 0
        ? ` Team: ${ctx.agentNames.join(", ")}.`
        : " No AI employees yet.";
    return {
      intent: "capabilities",
      message: `${apps}${team}\n\nI can:\n• Hire and open AI employees\n• Check connected apps (inbox, Slack, Notion, GitHub, …)\n• Show Work Board status\n• Only real actions — never fake results`,
    };
  }

  if (LIST_CONNECTED.test(t)) {
    if (!labels.length) {
      return {
        intent: "list_connected",
        message: `Nothing connected (${used}/${limit} slots). Open Connections to link an app.`,
        navigateTo: "/connections",
      };
    }
    return {
      intent: "list_connected",
      message: `Connected (${used}/${limit}): ${labels.join(", ")}.`,
    };
  }

  if (CONNECTIONS_NAV.test(t)) {
    return {
      intent: "connections",
      message: "Opening Connections.",
      navigateTo: "/connections",
    };
  }

  if (VAULT.test(t)) {
    return {
      intent: "vault",
      message: "Opening Vault.",
      navigateTo: "/vault",
    };
  }

  if (SETTINGS.test(t)) {
    return {
      intent: "settings",
      message: "Opening Settings.",
      navigateTo: "/settings",
    };
  }

  if (PLANS.test(t)) {
    return {
      intent: "plans",
      message: "Opening Plans.",
      navigateTo: "/plans",
    };
  }

  if (
    HIRE.test(t) ||
    /\b(social media|content|research|sales|ops|operations|marketing)\b.*\b(employee|role|assistant)\b/i.test(
      t
    ) ||
    /\bhire\b/i.test(t)
  ) {
    return {
      intent: "hire",
      message: "Opening Hiring Desk.",
      navigateTo: "/agents/new",
      hireHint: t,
    };
  }

  if (STATUS.test(t)) {
    const failed = ctx.failedRunCount || 0;
    const recent = ctx.recentRunCount || 0;
    let line =
      recent > 0
        ? `${recent} recent run${recent === 1 ? "" : "s"} on the Work Board.`
        : "No recent work runs yet. Open an employee and start work — results land on the Work Board.";
    if (failed > 0) line += ` ${failed} need attention.`;
    return {
      intent: "work_status",
      message: line,
      navigateTo: "/activity",
    };
  }

  if (LIST_TEAM.test(t)) {
    if (!ctx.agentNames.length) {
      return {
        intent: "list_team",
        message: "No AI employees yet. Open Hiring Desk to hire one.",
        navigateTo: "/agents/new",
      };
    }
    const list = ctx.agentNames
      .slice(0, 12)
      .map((n, i) => `${i + 1}. ${n}`)
      .join("\n");
    return {
      intent: "list_team",
      message: list,
      navigateTo: "/agents",
    };
  }

  const agentId = findAgentId(t, ctx);
  if (agentId && /\b(run|start|execute|do (the )?work)\b/i.test(t)) {
    return {
      intent: "run_employee",
      message: "Opening that employee so you can start work.",
      navigateTo: `/agents/${agentId}`,
      agentId,
    };
  }

  if (agentId && /\b(open|manage|edit|talk to|configure|view)\b/i.test(t)) {
    return {
      intent: "configure_hint",
      message: "Opening that employee.",
      navigateTo: `/agents/${agentId}`,
      agentId,
    };
  }

  if (
    ctx.agentNames.length === 1 &&
    /\b(run|start) (it|work|them|the employee)\b/i.test(t)
  ) {
    const onlyId = Object.values(ctx.agentIdsByName || {})[0];
    if (onlyId) {
      return {
        intent: "run_employee",
        message: "Opening your employee to start work.",
        navigateTo: `/agents/${onlyId}`,
        agentId: onlyId,
      };
    }
  }

  const toolkit = detectToolkit(t, slugs);
  if (toolkit && (APP_OP.test(t) || slugs.includes(toolkit.toLowerCase()))) {
    const q = extractSearchQuery(t);
    return {
      intent: "app_operation",
      message: "Working…",
      toolkit,
      toolArgs: q ? { query: q } : undefined,
    };
  }

  if (toolkit && !slugs.includes(toolkit.toLowerCase())) {
    return {
      intent: "connections",
      message: `${toolkitLabel(toolkit)} isn’t connected yet (${used}/${limit} slots used). Opening Connections.`,
      navigateTo: "/connections",
    };
  }

  if (APP_OP.test(t) && slugs.length === 1) {
    return {
      intent: "app_operation",
      message: "Working…",
      toolkit: slugs[0],
    };
  }

  if (/\b(joke|poem|weather|lyrics|recipe|homework|capital of)\b/i.test(t)) {
    return {
      intent: "chat",
      message: "I’m here for your AI team, connected apps, and real work — not general chat.",
      useModel: false,
    };
  }

  if (/\b(stuck|not working|broken|nothing happens|empty board|no results|how do i start|get started|onboarding)\b/i.test(t)) {
    if (!labels.length && !ctx.agentNames.length) {
      return {
        intent: "chat",
        message:
          "Quick path: (1) Open Connections and link an app. (2) Hire an AI employee. (3) Open them and Start work. Results show on the Work Board.",
        useModel: true,
      };
    }
    if (!labels.length) {
      return {
        intent: "connections",
        message: "Link an app first so employees can use real accounts. Opening Connections.",
        navigateTo: "/connections",
      };
    }
    if (!ctx.agentNames.length) {
      return {
        intent: "hire",
        message: "You have apps connected. Next: hire an AI employee. Opening Hiring Desk.",
        navigateTo: "/agents/new",
        hireHint: t,
      };
    }
    return {
      intent: "work_status",
      message:
        "Open an employee and press Start work. When a run finishes (or needs approval), it appears on the Work Board.",
      navigateTo: "/activity",
    };
  }

  if (/\b(schedule|daily|weekly|every day)\b/i.test(t) && /\b(employee|work|run|job)\b/i.test(t)) {
    return {
      intent: "hire",
      message: "Schedules are set on the employee — open your team or Hiring Desk to set daily/weekly.",
      navigateTo: ctx.agentNames.length ? "/agents" : "/agents/new",
      hireHint: t,
    };
  }

  if (ctx.agentNames.length === 0 && labels.length === 0) {
    return {
      intent: "chat",
      message:
        "Start by connecting an app or hiring an AI employee. I only run real actions on accounts you authorize.",
      useModel: false,
    };
  }

  const tips: string[] = [];
  if (labels[0]) tips.push(`“check ${labels[0]}”`);
  if (ctx.agentNames[0]) tips.push(`“open ${ctx.agentNames[0]}”`);
  tips.push("“list my team”", "“what’s connected”", "“work board”");

  return {
    intent: "chat",
    message: `I can help with that through your team or apps. Try: ${tips.slice(0, 4).join(", ")}.`,
    useModel: false,
  };
}

function toolkitLabel(slug: string): string {
  const map: Record<string, string> = {
    gmail: "Gmail",
    slack: "Slack",
    notion: "Notion",
    github: "GitHub",
    outlook: "Outlook",
    googledrive: "Google Drive",
    googlecalendar: "Google Calendar",
    googlesheets: "Google Sheets",
  };
  return map[slug] || slug;
}

export function workforceEmptyState(_ctx: WorkforceContext): {
  headline: string;
  body: string;
  suggestions: string[];
} {
  return { headline: "", body: "", suggestions: [] };
}
