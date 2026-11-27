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
  | "app_operation"
  | "configure_hint"
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
  /\b(hire|create|build|make|set up|setup|need)\b.*\b(employee|agent|assistant|role|worker)\b|\b(new employee|new agent|hiring desk)\b|\b(employee|agent)\b.*\b(for|that|to)\b/i;

const LIST_TEAM =
  /\b(list (my )?(team|employees|agents)|who (do i|have i) (hired|got)|show (me )?(my )?(team|employees)|\bwho is on (my )?(team|staff))\b/i;

const STATUS =
  /\b(what (did|have) (my )?(employees?|agents?|team) (do|done|accomplish)|work (board|history|status)|failed runs?|needs attention|today'?s (work|results?))\b/i;

const CONNECTIONS =
  /\b(connect(ions?|ed)?|integrat)\b|\b(connect|link)\b.*\b[a-z0-9_-]{2,}\b|\bmanage connections\b|\bwhich apps? (are )?(connected|linked)\b/i;

const APP_OP =
  /\b(check|fetch|get|list|read|show|summarize|send|post|create|find|search)\b.*\b(gmail|email|slack|notion|hubspot|github|google drive|calendar|outlook|discord|linear|asana|trello|jira|sheets?|docs?)\b|\b(gmail|slack|notion|hubspot|github|outlook|discord|linear)\b.*\b(messages?|emails?|pages?|contacts?|leads?|issues?|tasks?)\b/i;

function detectToolkit(t: string): string | undefined {
  const lower = t.toLowerCase();
  if (/\bgmail\b|\binbox\b/.test(lower) && !/outlook/.test(lower)) return "gmail";
  if (/\boutlook\b/.test(lower)) return "outlook";
  if (/\bslack\b/.test(lower)) return "slack";
  if (/\bnotion\b/.test(lower)) return "notion";
  if (/\bhubspot\b/.test(lower)) return "hubspot";
  if (/\bgithub\b/.test(lower)) return "github";
  if (/\bgoogle drive\b|\bgdrive\b/.test(lower)) return "googledrive";
  if (/\bgoogle calendar\b|\bcalendar\b/.test(lower)) return "googlecalendar";
  if (/\bgoogle sheets?\b|\bsheets?\b/.test(lower)) return "googlesheets";
  if (/\bgoogle docs?\b/.test(lower)) return "googledocs";
  if (/\bdiscord\b/.test(lower)) return "discord";
  if (/\blinear\b/.test(lower)) return "linear";
  if (/\basana\b/.test(lower)) return "asana";
  if (/\btrello\b/.test(lower)) return "trello";
  if (/\bjira\b/.test(lower)) return "jira";
  if (/\btwitter\b|\b\bx\b.*\b(post|tweet)/.test(lower)) return "twitter";
  if (/\blinkedin\b/.test(lower)) return "linkedin";
  if (/\bemail\b/.test(lower)) return "gmail";
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

  if (!t) {
    return { intent: "clarify", message: `What do you need${name}?` };
  }

  if (REFUSE.test(t)) {
    return {
      intent: "refuse",
      message: "I can’t help with that.",
    };
  }

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))[\s!.]*$/i.test(t)) {
    return {
      intent: "chat",
      message: `Hi${name}.`,
    };
  }

  if (/\b(joke|poem|weather|lyrics|recipe|homework|capital of)\b/i.test(t)) {
    return {
      intent: "chat",
      message: "I’m here for your AI team, apps, and real work.",
      useModel: false,
    };
  }

  if (
    HIRE.test(t) ||
    /\b(social media|content|research|sales|ops|operations)\b.*\b(employee|agent|role)\b/i.test(
      t
    )
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
        message: "No AI employees yet.",
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

  if (APP_OP.test(t)) {
    const toolkit = detectToolkit(t);
    return {
      intent: "app_operation",
      message: toolkit ? `Checking ${toolkit}…` : "Checking connected apps…",
      toolkit,
    };
  }

  if (CONNECTIONS.test(t)) {
    return {
      intent: "connections",
      message: "Opening Connections.",
      navigateTo: "/connections",
    };
  }

  return {
    intent: "chat",
    message: "Tell me what you need — team, work, or a connected app.",
    useModel: false,
  };
}

/** @deprecated Phase 1: empty state chips removed from UI */
export function workforceEmptyState(_ctx: WorkforceContext): {
  headline: string;
  body: string;
  suggestions: string[];
} {
  return { headline: "", body: "", suggestions: [] };
}
