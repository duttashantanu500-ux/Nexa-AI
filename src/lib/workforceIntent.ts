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
  /** Suggested Composio toolkit when app_operation */
  toolkit?: string;
  /** Suggested tool slug when known */
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
  /\b(connect(ions?|ed)?|integrat|oauth)\b|\b(connect|link)\b.*\b(gmail|notion|slack|hubspot|buffer|github|google)\b|\bmanage connections\b|\bwhich apps? (are )?(connected|linked)\b/i;

/** Detect ask to use a connected app (not just open Connections). */
const APP_OP =
  /\b(check|fetch|get|list|read|show|summarize|send|post|create|find|search)\b.*\b(gmail|email|slack|notion|hubspot|github|google drive|calendar|leads?|contacts?|messages?|inbox)\b|\b(gmail|slack|notion|hubspot|github)\b.*\b(messages?|emails?|pages?|contacts?|leads?|issues?)\b/i;

function detectToolkit(t: string): string | undefined {
  const lower = t.toLowerCase();
  if (/\bgmail\b|\binbox\b|\bemail\b/.test(lower)) return "gmail";
  if (/\bslack\b/.test(lower)) return "slack";
  if (/\bnotion\b/.test(lower)) return "notion";
  if (/\bhubspot\b|\bleads?\b|\bcontacts?\b/.test(lower)) return "hubspot";
  if (/\bgithub\b/.test(lower)) return "github";
  if (/\bgoogle drive\b|\bgdrive\b/.test(lower)) return "googledrive";
  if (/\bcalendar\b/.test(lower)) return "googlecalendar";
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
    return {
      intent: "clarify",
      message: `What do you need${name}? You can hire an AI employee, check your team, use connected apps, or ask about recent work.`,
    };
  }

  if (REFUSE.test(t)) {
    return {
      intent: "refuse",
      message:
        "I can't help with that. Nexa only runs authorized work with your connected tools and hired AI employees.",
    };
  }

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))[\s!.]*$/i.test(t)) {
    const team =
      ctx.agentNames.length > 0
        ? ` You have ${ctx.agentNames.length} AI employee${ctx.agentNames.length === 1 ? "" : "s"} on the team.`
        : " Your digital team is empty — hire a role when you're ready.";
    return {
      intent: "chat",
      message: `Hi${name}.${team} Hire talent, assign real work, or manage connections. What should we do?`,
    };
  }

  if (/\b(joke|poem|weather|lyrics|recipe|homework|capital of)\b/i.test(t)) {
    return {
      intent: "chat",
      message:
        "I can chat briefly, but Nexa is built for your digital workforce — hiring AI employees, connecting apps, and running real work.\n\nTry: “Hire a research employee”, “What did my team do today?”, or “Connect Gmail”.",
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
      message:
        "Opening the Hiring Desk with your request. Describe the role there — or keep typing if you want to refine it first.",
      navigateTo: "/agents/new",
      hireHint: t,
    };
  }

  if (STATUS.test(t)) {
    const failed = ctx.failedRunCount || 0;
    const recent = ctx.recentRunCount || 0;
    let line =
      recent > 0
        ? `There ${recent === 1 ? "is" : "are"} ${recent} recent run${recent === 1 ? "" : "s"} on the Work Board.`
        : "No recent work runs yet.";
    if (failed > 0) {
      line += ` ${failed} need attention.`;
    }
    return {
      intent: "work_status",
      message: `${line}\n\nOpen the Work Board for full history — I never invent completed tasks.`,
      navigateTo: "/activity",
    };
  }

  if (LIST_TEAM.test(t)) {
    if (!ctx.agentNames.length) {
      return {
        intent: "list_team",
        message:
          "You don't have any AI employees yet. Open the Hiring Desk to hire your first role.",
        navigateTo: "/agents/new",
      };
    }
    const list = ctx.agentNames
      .slice(0, 12)
      .map((n, i) => `${i + 1}. ${n}`)
      .join("\n");
    return {
      intent: "list_team",
      message: `Your AI team:\n${list}\n\nOpen AI Team to manage them, or name someone to run their work.`,
      navigateTo: "/agents",
    };
  }

  const agentId = findAgentId(t, ctx);
  if (agentId && /\b(run|start|execute|do (the )?work)\b/i.test(t)) {
    return {
      intent: "run_employee",
      message: "Opening that employee so you can start their assigned work.",
      navigateTo: `/agents/${agentId}`,
      agentId,
    };
  }

  if (agentId && /\b(open|manage|edit|talk to|configure)\b/i.test(t)) {
    return {
      intent: "configure_hint",
      message: "Opening that employee’s management chat.",
      navigateTo: `/agents/${agentId}`,
      agentId,
    };
  }

  // App operation before generic connections / unsupported
  if (APP_OP.test(t)) {
    const toolkit = detectToolkit(t);
    return {
      intent: "app_operation",
      message: toolkit
        ? `I'll use your connected ${toolkit} account if it's linked. Checking Connections…`
        : "I'll check your connected apps for that request.",
      toolkit,
    };
  }

  if (CONNECTIONS.test(t)) {
    return {
      intent: "connections",
      message:
        "Open Connections to browse the app marketplace and link up to 3 accounts. Status there is the source of truth.",
      navigateTo: "/connections",
    };
  }

  return {
    intent: "chat",
    message:
      "I can help you hire AI employees, review your team, check work status, or use connected apps.\n\nExamples:\n• Hire a social media employee\n• What did my team do today?\n• Check my latest Gmail messages\n• Connect Slack",
    useModel: false,
  };
}

export function workforceEmptyState(ctx: WorkforceContext): {
  headline: string;
  body: string;
  suggestions: string[];
} {
  const n = ctx.agentNames.length;
  const teamLine =
    n === 0
      ? "Your digital team is empty."
      : `You have ${n} AI employee${n === 1 ? "" : "s"}.`;
  const suggestions =
    n === 0
      ? [
          "Hire a research employee",
          "Connect Gmail",
          "What can Nexa do?",
          "Manage connections",
        ]
      : [
          "What did my team do today?",
          "List my employees",
          "Check my latest Gmail messages",
          "Manage connections",
        ];
  return {
    headline: "Command your AI team",
    body: `${teamLine} Hire roles, connect apps (up to 3), and run real work — not simulated demos.`,
    suggestions,
  };
}
