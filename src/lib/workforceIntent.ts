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
  /** Soft navigation targets for the UI */
  navigateTo?: string;
  /** Prefill for hire desk */
  hireHint?: string;
  /** Employee id when run_employee */
  agentId?: string;
  /** When true, UI may call LLM for a richer conversational reply */
  useModel?: boolean;
};

const REFUSE =
  /\b(hack|steal|bypass password|credit card|ssn|wire transfer|malware|ransomware|illegal)\b/i;

const HIRE =
  /\b(hire|create|build|make|set up|setup|need)\b.*\b(employee|agent|assistant|role|worker)\b|\b(new employee|new agent|hiring desk)\b|\b(employee|agent)\b.*\b(for|that|to)\b/i;

const LIST_TEAM =
  /\b(my (team|employees|agents)|list (my )?(team|employees|agents)|who (do i|have i) (hired|got)|show (me )?(my )?(team|employees))\b/i;

const STATUS =
  /\b(what (did|have) (my )?(employees?|agents?|team) (do|done|accomplish)|work (board|history|status)|failed runs?|needs attention|today'?s (work|results?))\b/i;

const CONNECTIONS =
  /\b(connect(ions?|ed)?|integrat|oauth|notion|slack|hubspot|buffer)\b.*\b(status|connected|connect|link)\b|\b(connect|link)\b.*\b(notion|slack|hubspot|buffer)\b|\bmanage connections\b/i;

const UNSUPPORTED_TOOL =
  /\b(gmail|outlook|email|whatsapp|twitter|x\.com|instagram|shopify|stripe|quickbooks|asana|jira|linear|discord)\b/i;

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
      message: `What do you need${name}? You can hire an AI employee, check your team, open connections, or ask about recent work.`,
    };
  }

  if (REFUSE.test(t)) {
    return {
      intent: "refuse",
      message:
        "I can't help with that. Nexa only runs authorized work with your connected tools and hired AI employees.",
    };
  }

  if (
    /^(hi|hello|hey|yo|good (morning|afternoon|evening))[\s!.]*$/i.test(t)
  ) {
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
        "I can chat briefly, but Nexa is built for your digital workforce — hiring AI employees, connecting tools, and running real work.\n\nTry: “Hire a research employee”, “What did my team do today?”, or “Connect Notion”.",
      useModel: false,
    };
  }

  if (HIRE.test(t) || /\b(social media|content|research|sales|ops|operations)\b.*\b(employee|agent|role)\b/i.test(t)) {
    return {
      intent: "hire",
      message:
        "Opening the Hiring Desk with your request. Describe the role there — or keep typing if you want to refine it first.",
      navigateTo: "/agents/new",
      hireHint: t,
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

  const agentId = findAgentId(t, ctx);
  if (
    agentId &&
    /\b(run|start|execute|do (the )?work)\b/i.test(t)
  ) {
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

  if (CONNECTIONS.test(t)) {
    return {
      intent: "connections",
      message:
        "Open Connections to link Notion, Slack, HubSpot, Buffer, and more. Status there is the source of truth.",
      navigateTo: "/connections",
    };
  }

  if (UNSUPPORTED_TOOL.test(t) && /\b(connect|integrate|use|via|through)\b/i.test(t)) {
    return {
      intent: "unsupported",
      message:
        "That app isn’t a built-in Nexa connection yet. Today you can connect Notion, Slack, HubSpot, Buffer, Ideogram, Voice calling, and Custom tools.\n\nOpen Connections to see what’s available, or hire an employee that uses a supported tool.",
      navigateTo: "/connections",
    };
  }

  if (/\b(email|send (an? )?email)\b/i.test(t)) {
    return {
      intent: "unsupported",
      message:
        "Nexa doesn’t send email yet. For team messages, connect Slack and hire or configure an employee with a send-message step.",
    };
  }

  return {
    intent: "chat",
    message:
      "I can help you hire AI employees, review your team, check work status, or open connections.\n\nExamples:\n• Hire a social media employee\n• What did my team do today?\n• Connect Notion\n• List my employees",
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
          "Hire a social media employee",
          "Connect Notion",
          "What can Nexa do?",
        ]
      : [
          "What did my team do today?",
          "List my employees",
          "Hire another employee",
          "Manage connections",
        ];
  return {
    headline: "Command your AI team",
    body: `${teamLine} Hire roles, assign real work through connected tools, and track results on the Work Board — not simulated chat demos.`,
    suggestions,
  };
}
