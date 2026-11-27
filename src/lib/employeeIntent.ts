/**
 * Intent understanding for messages to an EXISTING AI employee.
 * Deterministic. Never invents capabilities or completed work.
 */

export type EmployeeIntent =
  | "chat"
  | "work"
  | "configure"
  | "history"
  | "refuse"
  | "clarify"
  | "missing_connector";

export type IntentContext = {
  agentName: string;
  purpose?: string;
  description?: string;
  actionIds: string[];
  stepNames?: string[];
  connected: Record<string, boolean>;
  hasSteps: boolean;
  scheduleLabel?: string;
};

export type IntentResult = {
  intent: EmployeeIntent;
  message: string;
  shouldStartWork?: boolean;
  suggestConfigure?: boolean;
  suggestedConnector?: string;
};

const REFUSE_PATTERNS =
  /\b(delete all|wipe|destroy|hack|steal|bypass|password|credit card|ssn|bank account|wire transfer|illegal|malware|ransomware)\b/i;

const CONFIGURE_PATTERNS =
  /\b(change (your |my |the )?schedule|reschedule|working hours?|every (monday|tuesday|wednesday|thursday|friday|saturday|sunday|day|week|month)|add (a )?step|remove (a )?step|rename|update (the )?(role|purpose|instructions|responsibilit)|use (slack|notion|hubspot|buffer)|switch tool|configure|edit (this |the )?employee|pause (scheduled )?work|stop publishing|without (my )?approval|connect another tool)\b/i;

const WORK_PATTERNS =
  /\b(run|start work|do (the )?work|execute|create (a )?page|save (to|in) notion|post (to|on) slack|send (a )?message|list contacts|create contact|schedule (a )?post|publish|go ahead|do it now|start (a )?new task)\b/i;

const HISTORY_PATTERNS =
  /\b(what did you (do|work on|accomplish)|work(ed)? on (yesterday|today|last week)|history|past runs?|recent (work|runs?|results?)|show (me )?(results?|runs?|history)|performance)\b/i;

function connectorsFromActions(actionIds: string[]): string[] {
  const set = new Set<string>();
  for (const id of actionIds) {
    const p = String(id || "").split(".")[0];
    if (p && p !== "local_data") set.add(p);
  }
  return [...set];
}

function friendlyConnector(id: string): string {
  const map: Record<string, string> = {
    notion: "Notion",
    slack: "Slack",
    buffer: "Buffer",
    hubspot: "HubSpot",
    gmail: "Gmail",
    github: "GitHub",
    mcp: "Custom tools",
  };
  return map[id] || id;
}

function missingRequired(
  actionIds: string[],
  connected: Record<string, boolean>
): string | null {
  for (const id of actionIds) {
    const p = String(id || "").split(".")[0];
    if (!p || p === "local_data") continue;
    if (connected[p] === false) return p;
  }
  return null;
}

export function emptyStateForEmployee(_ctx: IntentContext): {
  headline: string;
  body: string;
  suggestions: string[];
} {
  return { headline: "", body: "", suggestions: [] };
}

export function classifyEmployeeMessage(
  text: string,
  ctx: IntentContext
): IntentResult {
  const t = (text || "").trim();
  const name = ctx.agentName || "this employee";
  const purpose =
    (ctx.purpose || ctx.description || "").trim() || "assigned work";

  if (!t) {
    return { intent: "clarify", message: `What should ${name} do?` };
  }

  if (REFUSE_PATTERNS.test(t)) {
    return { intent: "refuse", message: "I can’t help with that." };
  }

  if (HISTORY_PATTERNS.test(t)) {
    return {
      intent: "history",
      message: "See Work history on this page for past runs.",
    };
  }

  if (
    /\b(pause (scheduled )?work|stop (the )?schedule|disable schedule)\b/i.test(t)
  ) {
    return {
      intent: "configure",
      suggestConfigure: true,
      message: "Updating schedule…",
    };
  }

  if (CONFIGURE_PATTERNS.test(t)) {
    return {
      intent: "configure",
      suggestConfigure: true,
      message: "Updating setup…",
    };
  }

  if (WORK_PATTERNS.test(t) || /^(go|start|run)(\s+it)?[\s!.]*$/i.test(t)) {
    if (!ctx.hasSteps) {
      return {
        intent: "clarify",
        suggestConfigure: true,
        message: `${name} has no steps yet. Describe the job to configure.`,
      };
    }
    const missing = missingRequired(ctx.actionIds, ctx.connected);
    if (missing) {
      return {
        intent: "missing_connector",
        suggestedConnector: missing,
        message: `${friendlyConnector(missing)} isn’t connected. Link it under Connections, then start again.`,
      };
    }
    return {
      intent: "work",
      shouldStartWork: true,
      message: `Starting ${name}…`,
    };
  }

  if (
    /\b(what (can|do) you do|who are you|your (job|role|purpose)|what are you for)\b/i.test(
      t
    )
  ) {
    const tools = connectorsFromActions(ctx.actionIds)
      .map(friendlyConnector)
      .join(", ");
    return {
      intent: "chat",
      message: `${name}: ${purpose}${tools ? ` · Tools: ${tools}` : ""}`,
    };
  }

  if (
    /\b(change|update|edit|rename|schedule|every|add|remove|step|timezone)\b/i.test(
      t
    )
  ) {
    return {
      intent: "configure",
      suggestConfigure: true,
      message: "Updating setup…",
    };
  }

  return {
    intent: "chat",
    message: `${name}. ${purpose}`,
  };
}
