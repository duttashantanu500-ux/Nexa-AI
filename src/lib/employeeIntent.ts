/**
 * Central intent understanding for messages to an EXISTING AI employee.
 * Deterministic — no model required. Never invents capabilities.
 * Distinguishes: chat, work, configure, history, refuse, clarify, missing_connector.
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
  /** Registry actionIds on this employee, e.g. notion.create_page */
  actionIds: string[];
  /** Human-readable step names when available */
  stepNames?: string[];
  /** connectorId -> connected? */
  connected: Record<string, boolean>;
  hasSteps: boolean;
  /** Optional schedule summary for richer replies */
  scheduleLabel?: string;
};

export type IntentResult = {
  intent: EmployeeIntent;
  /** Plain reply for the user (no technical jargon). */
  message: string;
  /** When true, parent should start the employee's configured workflow. */
  shouldStartWork?: boolean;
  /** Soft hint to open Configure path / builder edit */
  suggestConfigure?: boolean;
  suggestedConnector?: string;
};

const REFUSE_PATTERNS =
  /\b(delete all|wipe|destroy|hack|steal|bypass|password|credit card|ssn|bank account|wire transfer|illegal|malware|ransomware)\b/i;

const CONFIGURE_PATTERNS =
  /\b(change (your |my |the )?schedule|reschedule|working hours?|every (monday|tuesday|wednesday|thursday|friday|saturday|sunday|day|week|month)|add (a )?step|remove (a )?step|rename|update (the )?(role|purpose|instructions|responsibilit)|use (slack|notion|hubspot|buffer)|switch tool|configure|edit (this |the )?employee|pause (scheduled )?work|stop publishing|without (my )?approval|connect another tool|add competitor|add research)\b/i;

const WORK_PATTERNS =
  /\b(run|start work|do (the )?work|execute|create (a )?page|save (to|in) notion|post (to|on) slack|send (a )?message|list contacts|create contact|schedule (a )?post|publish|generate (an? )?image|go ahead|do it now|start (a )?new task|assign (this |a )?task)\b/i;

const HISTORY_PATTERNS =
  /\b(what did you (do|work on|accomplish)|work(ed)? on (yesterday|today|last week)|history|past runs?|recent (work|runs?|results?)|what (have you|did you) (done|finish)|show (me )?(results?|runs?|history)|performance)\b/i;

const CLARIFY_SHORT =
  /^(ok|okay|yes|no|sure|thanks|thank you|hmm|idk|maybe|k|yep|nope)[\s!.?]*$/i;

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
    ideogram: "Ideogram",
    vapi: "Voice calling",
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

function stepsSummary(ctx: IntentContext): string {
  const names = (ctx.stepNames || []).filter(Boolean);
  if (names.length) {
    return names
      .slice(0, 6)
      .map((n, i) => `${i + 1}. ${n}`)
      .join("\n");
  }
  const ids = ctx.actionIds || [];
  if (!ids.length) return "";
  return ids
    .slice(0, 6)
    .map((id, i) => `${i + 1}. ${id.split(".").slice(1).join(".") || id}`)
    .join("\n");
}

/**
 * Contextual empty-state copy when the employee chat has no messages yet.
 */
export function emptyStateForEmployee(ctx: IntentContext): {
  headline: string;
  body: string;
  suggestions: string[];
} {
  const name = ctx.agentName || "this employee";
  const purpose =
    (ctx.purpose || ctx.description || "").trim() ||
    "the work they were hired for";
  const tools = connectorsFromActions(ctx.actionIds)
    .map(friendlyConnector)
    .join(", ");
  const schedule = ctx.scheduleLabel ? ` Schedule: ${ctx.scheduleLabel}.` : "";
  const steps = stepsSummary(ctx);

  const suggestions: string[] = [];
  if (ctx.hasSteps) {
    suggestions.push("Start work");
    suggestions.push("What did you work on recently?");
  } else {
    suggestions.push("Add a Notion page step");
    suggestions.push("Describe the job you should do");
  }
  suggestions.push("Run every weekday at 9 AM");
  if (tools.includes("Slack") || ctx.actionIds.some((a) => a.startsWith("slack."))) {
    suggestions.push("Add a Slack notification");
  }
  if (!tools || tools.includes("Notion")) {
    suggestions.push("What do you do?");
  }

  return {
    headline: `Managing ${name}`,
    body:
      `${purpose}${schedule}` +
      (tools ? `\nTools when connected: ${tools}.` : "") +
      (steps
        ? `\n\nCurrent steps:\n${steps}`
        : "\n\nNo steps yet — describe the job to configure them.") +
      `\n\nYou can change responsibilities, schedule, tools, or ask ${name} to start work.`,
    suggestions: suggestions.slice(0, 4),
  };
}

/**
 * Classify a user message in the context of one hired AI employee.
 */
export function classifyEmployeeMessage(
  text: string,
  ctx: IntentContext
): IntentResult {
  const t = (text || "").trim();
  const name = ctx.agentName || "this employee";
  const purpose =
    (ctx.purpose || ctx.description || "").trim() ||
    "the work they were hired for";

  if (!t) {
    return {
      intent: "clarify",
      message: `What would you like ${name} to do?`,
    };
  }

  if (REFUSE_PATTERNS.test(t)) {
    return {
      intent: "refuse",
      message: `I can't help with that. ${name} only does authorized work with your connected tools — nothing unsafe or outside your accounts.`,
    };
  }

  if (HISTORY_PATTERNS.test(t)) {
    return {
      intent: "history",
      message: `Open **Work history** on this page for ${name}'s past runs and results. I don't invent outcomes — only completed work appears there.\n\nIf you want a new run, say **start work**.`,
    };
  }

  if (
    /\b(pause (scheduled )?work|stop (the )?schedule|disable schedule|turn off (the )?schedule)\b/i.test(
      t
    )
  ) {
    return {
      intent: "configure",
      suggestConfigure: true,
      message: `I'll help pause ${name}'s schedule. Confirm by saying something like "disable schedule" or "run only when I say start work", and I'll apply it.`,
    };
  }

  if (CONFIGURE_PATTERNS.test(t)) {
    return {
      intent: "configure",
      suggestConfigure: true,
      message: `I'll update how ${name} is set up. Applying your change to schedule, steps, or tools…`,
    };
  }

  if (WORK_PATTERNS.test(t) || /^(go|start|run)(\s+it)?[\s!.]*$/i.test(t)) {
    if (!ctx.hasSteps) {
      return {
        intent: "clarify",
        suggestConfigure: true,
        message: `${name} has no workflow steps yet. Describe the job you want them to do, and I'll help configure it.`,
      };
    }

    const missing = missingRequired(ctx.actionIds, ctx.connected);
    if (missing) {
      return {
        intent: "missing_connector",
        suggestedConnector: missing,
        message: `${name} needs ${friendlyConnector(missing)} connected under Connections before this work can run. Connect it, then ask me to start again.`,
      };
    }

    return {
      intent: "work",
      shouldStartWork: true,
      message: `Starting **${name}**'s assigned work now. Some steps may need your approval before they finish.`,
    };
  }

  if (CLARIFY_SHORT.test(t) || t.length < 3) {
    return {
      intent: "clarify",
      message: `I'm ${name}. I can run assigned work, answer what I do, change schedule or steps, or point you to work history. What do you need?`,
    };
  }

  if (
    /\b(what (can|do) you do|who are you|your (job|role|purpose)|what are you for|help me|what('s| is) your (job|role))\b/i.test(
      t
    )
  ) {
    const tools = connectorsFromActions(ctx.actionIds)
      .map(friendlyConnector)
      .join(", ");
    const toolLine = tools
      ? `Tools I use when connected: ${tools}.`
      : "I work with the steps configured for me.";
    const steps = stepsSummary(ctx);
    const stepBlock = steps ? `\n\nCurrent steps:\n${steps}` : "";
    return {
      intent: "chat",
      message: `I'm **${name}**. ${purpose}\n\n${toolLine}${stepBlock}\n\nSay **start work** to run, ask about **work history**, or tell me how to change schedule or steps.`,
    };
  }

  if (
    /\b(weather|joke|quantum|birthday|poem|recipe|capital of|who is the president|tell me a story|lyrics)\b/i.test(
      t
    )
  ) {
    return {
      intent: "chat",
      message: `I can chat briefly, but this conversation is for managing **${name}** (${purpose}). I don't invent weather or web answers.\n\nFor real work: **start work**. To change setup: schedule, steps, or tools. For past results: ask about **work history**.`,
    };
  }

  if (
    /\b(send (an? )?email|access (my )?bank|build (me )?an? (app|application)|call (this )?number)\b/i.test(
      t
    )
  ) {
    const needsCall = /call/i.test(t);
    if (needsCall && ctx.actionIds.some((a) => a.startsWith("vapi."))) {
      if (ctx.connected.vapi === false) {
        return {
          intent: "missing_connector",
          suggestedConnector: "vapi",
          message:
            "Voice calling is part of this employee's tools, but it isn't connected yet. Connect Voice calling under Connections first.",
        };
      }
    }
    if (/email/i.test(t)) {
      return {
        intent: "refuse",
        message:
          "Nexa doesn't send email yet. I can't claim that capability. If you need messages to a team channel, connect Slack and add a send-message step.",
      };
    }
    return {
      intent: "refuse",
      message: `That isn't something ${name} can do with the tools available in Nexa. I only use your connected accounts and the steps on this employee.`,
    };
  }

  if (/\b(sales|contacts?|deals?|crm|pipeline|leads?)\b/i.test(t)) {
    if (ctx.actionIds.some((a) => a.startsWith("hubspot."))) {
      if (ctx.connected.hubspot === false) {
        return {
          intent: "missing_connector",
          suggestedConnector: "hubspot",
          message:
            "This employee is set up for HubSpot, but HubSpot isn't connected. Connect it under Connections, then say **start work**.",
        };
      }
      if (WORK_PATTERNS.test(t) || /\b(list|find|get|show)\b/i.test(t)) {
        return {
          intent: "work",
          shouldStartWork: true,
          message: `This looks like CRM work for ${name}. Starting the workflow — approve any write steps when asked.`,
        };
      }
      return {
        intent: "chat",
        message: `${name} can work with HubSpot when connected. Say **start work** to run the assigned CRM steps, or tell me what to change about contacts, deals, or schedule.`,
      };
    }
    return {
      intent: "missing_connector",
      suggestedConnector: "hubspot",
      message:
        "I don't have HubSpot on this employee's steps. Connect HubSpot under Connections, then ask me to add CRM steps — or hire a sales employee that includes them.",
    };
  }

  if (
    /\b(change|update|edit|rename|schedule|every|add|remove|step|timezone|parent page|channel|approval)\b/i.test(
      t
    )
  ) {
    return {
      intent: "configure",
      suggestConfigure: true,
      message: `I'll treat that as a setup change for ${name}. Updating now…`,
    };
  }

  return {
    intent: "chat",
    message: `I'm ${name}. ${purpose}\n\nI can run my assigned workflow (**start work**), explain what I'm set up to do, help change steps and schedule, or point you to **work history**.\n\nWhat would you like?`,
  };
}
