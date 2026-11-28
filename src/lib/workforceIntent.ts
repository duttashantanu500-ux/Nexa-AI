/**
 * Main Nexa chat intent — Digital Workforce command understanding.
 * Deterministic first. Never invents tool results or completed work.
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
};

const REFUSE =
  /\b(hack|steal|bypass password|credit card|ssn|wire transfer|malware|ransomware|illegal)\b/i;

const HIRE =
  /\b(hire|create|build|make|set up|setup|need|want)\b.*\b(employee|assistant|role|worker|teammate)\b|\b(new employee|hiring desk)\b|\b(employee)\b.*\b(for|that|to)\b/i;

const LIST_TEAM =
  /\b(list (my )?(team|employees)|who (do i|have i) (hired|got)|show (me )?(my )?(team|employees)|\bwho is on (my )?(team|staff))\b/i;

const STATUS =
  /\b(what (did|have) (my )?(employees?|team) (do|done|accomplish)|work (board|history|status)|failed runs?|needs attention|today'?s (work|results?))\b/i;

const LIST_CONNECTED =
  /\b(what('?s| is| are)? (my )?(connected|linked) (apps?|accounts?|tools?)|which apps? (are )?(connected|linked)|show (my )?connections?|list (my )?(connected )?apps?)\b/i;

const CONNECTIONS_NAV =
  /\b(open connections?|manage connections?|go to connections?|connect (an? )?app)\b/i;

const CAPABILITIES =
  /\b(what can you do|what do you do|how (do|can) (i|you)|help me|capabilities|what (apps?|tools?) (can|do) you)\b/i;

const APP_OP =
  /\b(check|fetch|get|list|read|show|summarize|send|post|create|find|search|open)\b/i;

const KNOWN_TOOLKITS: { re: RegExp; slug: string }[] = [
  { re: /\bgmail\b|\binbox\b(?!.*outlook)/i, slug: "gmail" },
  { re: /\boutlook\b/i, slug: "outlook" },
  { re: /\bslack\b/i, slug: "slack" },
  { re: /\bnotion\b/i, slug: "notion" },
  { re: /\bgithub\b/i, slug: "github" },
  { re: /\bgoogle drive\b|\bgdrive\b/i, slug: "googledrive" },
  { re: /\bgoogle calendar\b|\bcalendar\b/i, slug: "googlecalendar" },
  { re: /\bgoogle sheets?\b|\bsheets?\b/i, slug: "googlesheets" },
  { re: /\bgoogle docs?\b/i, slug: "googledocs" },
  { re: /\bdiscord\b/i, slug: "discord" },
  { re: /\blinear\b/i, slug: "linear" },
  { re: /\basana\b/i, slug: "asana" },
  { re: /\btrello\b/i, slug: "trello" },
  { re: /\bjira\b/i, slug: "jira" },
  { re: /\btwitter\b|\btweet/i, slug: "twitter" },
  { re: /\blinkedin\b/i, slug: "linkedin" },
  { re: /\bairtable\b/i, slug: "airtable" },
  { re: /\byoutube\b/i, slug: "youtube" },
  { re: /\bemail\b/i, slug: "gmail" },
];

export function detectToolkit(
  t: string,
  connectedSlugs?: string[]
): string | undefined {
  const lower = t.toLowerCase();
  for (const { re, slug } of KNOWN_TOOLKITS) {
    if (re.test(lower)) return slug;
  }
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
  for (const [name, id] of Object.entries(ctx.agentIdsByName || {})) {
    if (name && lower.includes(name.toLowerCase())) return id;
  }
  return undefined;
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

  if (!t) {
    return { intent: "clarify", message: `What do you need${name}?` };
  }

  if (REFUSE.test(t)) {
    return { intent: "refuse", message: "I can’t help with that." };
  }

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))[\s!.]*$/i.test(t)) {
    const apps =
      labels.length > 0
        ? ` ${labels.slice(0, 4).join(", ")} connected.`
        : "";
    const team =
      ctx.agentNames.length > 0
        ? ` ${ctx.agentNames.length} on your team.`
        : "";
    return {
      intent: "chat",
      message: `Hi${name}.${apps}${team} Hire, check apps, or run work — say what you need.`,
    };
  }

  if (CAPABILITIES.test(t) || /\bwhat can nexa do\b/i.test(t)) {
    const apps =
      labels.length > 0
        ? `Connected (${used}/${limit}): ${labels.join(", ")}.`
        : `No apps connected (${used}/${limit} slots).`;
    const team =
      ctx.agentNames.length > 0
        ? ` Team: ${ctx.agentNames.length} AI employee${ctx.agentNames.length === 1 ? "" : "s"}.`
        : " No AI employees yet.";
    return {
      intent: "capabilities",
      message: `${apps}${team} I can hire employees, work with connected apps, and show the Work Board — only real actions.`,
    };
  }

  if (LIST_CONNECTED.test(t)) {
    if (!labels.length) {
      return {
        intent: "list_connected",
        message: `Nothing connected (${used}/${limit} slots). Open Connections to link an app.`,
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
        : "No recent work runs yet.";
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
      message: "Opening that employee.",
      navigateTo: `/agents/${agentId}`,
      agentId,
    };
  }

  if (agentId && /\b(open|manage|edit|talk to|configure)\b/i.test(t)) {
    return {
      intent: "configure_hint",
      message: "Opening that employee.",
      navigateTo: `/agents/${agentId}`,
      agentId,
    };
  }

  const toolkit = detectToolkit(t, ctx.connectedSlugs);
  if (toolkit && APP_OP.test(t)) {
    return {
      intent: "app_operation",
      message: "Working…",
      toolkit,
    };
  }

  if (toolkit && (ctx.connectedSlugs || []).includes(toolkit)) {
    return {
      intent: "app_operation",
      message: "Working…",
      toolkit,
    };
  }

  if (toolkit && !(ctx.connectedSlugs || []).includes(toolkit)) {
    return {
      intent: "connections",
      message: `That app isn’t connected yet. Open Connections to link it (${used}/${limit} slots used).`,
      navigateTo: "/connections",
    };
  }

  if (/\b(joke|poem|weather|lyrics|recipe|homework|capital of)\b/i.test(t)) {
    return {
      intent: "chat",
      message: "I’m here for your AI team, apps, and real work.",
      useModel: false,
    };
  }

  // Helpful default — never dump old “connect Notion Slack Buffer / hire once” spam
  if (ctx.agentNames.length === 0 && labels.length === 0) {
    return {
      intent: "chat",
      message:
        "Start by connecting an app or hiring an AI employee. I only run real actions on accounts you authorize.",
      useModel: false,
    };
  }

  return {
    intent: "chat",
    message:
      labels.length > 0
        ? `Try: “list my team”, “what’s connected”, or “check ${labels[0]}”.`
        : "Try: “hire a research employee”, “list my team”, or “open connections”.",
    useModel: false,
  };
}

export function workforceEmptyState(_ctx: WorkforceContext): {
  headline: string;
  body: string;
  suggestions: string[];
} {
  return { headline: "", body: "", suggestions: [] };
}
