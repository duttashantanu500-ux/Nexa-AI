/**
 * Central intent understanding for messages to an EXISTING AI employee.
 * Deterministic — no model required. Never invents capabilities.
 */

export type EmployeeIntent =
  | "chat"
  | "work"
  | "configure"
  | "refuse"
  | "clarify"
  | "missing_connector";

export type IntentContext = {
  agentName: string;
  purpose?: string;
  description?: string;
  /** Registry actionIds on this employee, e.g. notion.create_page */
  actionIds: string[];
  /** connectorId -> connected? */
  connected: Record<string, boolean>;
  hasSteps: boolean;
};

export type IntentResult = {
  intent: EmployeeIntent;
  /** Plain reply for the user (no technical jargon). */
  message: string;
  /** When true, parent should start the employee's configured workflow. */
  shouldStartWork?: boolean;
  /** Soft hint to open Configure tab */
  suggestConfigure?: boolean;
  suggestedConnector?: string;
};

const REFUSE_PATTERNS =
  /\b(delete all|wipe|destroy|hack|steal|bypass|password|credit card|ssn|bank account|wire transfer|illegal|malware|ransomware)\b/i;

const CONFIGURE_PATTERNS =
  /\b(change schedule|reschedule|every (monday|friday|day|week)|add (a )?step|remove (a )?step|rename|update (the )?(role|purpose|instructions)|use (slack|notion|hubspot|buffer)|switch tool|configure|edit (this |the )?employee)\b/i;

const WORK_PATTERNS =
  /\b(run|start|do (the )?work|execute|create (a )?page|save (to|in) notion|post (to|on) slack|send (a )?message|list contacts|create contact|schedule (a )?post|publish|generate (an? )?image|go ahead|do it now|start work)\b/i;

const CLARIFY_SHORT = /^(ok|okay|yes|no|sure|thanks|thank you|hmm|idk|maybe)[\s!.?]*$/i;

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
      message:
        `I can't help with that. ${name} only does authorized work with your connected tools — nothing unsafe or outside your accounts.`,
    };
  }

  if (CONFIGURE_PATTERNS.test(t)) {
    return {
      intent: "configure",
      suggestConfigure: true,
      message:
        `I'll update how ${name} is set up. Describe the change (schedule, steps, or tools) and I'll apply it.`,
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
      message: `Ready to run **${name}**'s assigned work. Starting now — some steps may need your approval before they finish.`,
    };
  }

  if (CLARIFY_SHORT.test(t) || t.length < 3) {
    return {
      intent: "clarify",
      message: `I'm ${name}. I can run my assigned work, answer questions about what I do, or help you change my setup. What do you need?`,
    };
  }

  if (
    /\b(what (can|do) you do|who are you|your (job|role|purpose)|what are you for|help me)\b/i.test(
      t
    )
  ) {
    const tools = connectorsFromActions(ctx.actionIds)
      .map(friendlyConnector)
      .join(", ");
    const toolLine = tools
      ? `Tools I use when connected: ${tools}.`
      : "I work with the steps configured for me.";
    return {
      intent: "chat",
      message: `I'm **${name}**. ${purpose}\n\n${toolLine}\n\nSay **start work** when you want me to run, or ask me to change my schedule or steps.`,
    };
  }

  if (
    /\b(weather|joke|quantum|birthday|poem|recipe|capital of|who is the president)\b/i.test(
      t
    )
  ) {
    return {
      intent: "chat",
      message: `I can chat briefly, but I'm ${name} — hired for ${purpose}. I don't invent access to weather or general web answers.\n\nFor real work, say **start work**. To change what I do, tell me the schedule or steps to update.`,
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

  if (/\b(sales|contacts?|deals?|crm|pipeline)\b/i.test(t)) {
    if (ctx.actionIds.some((a) => a.startsWith("hubspot."))) {
      if (ctx.connected.hubspot === false) {
        return {
          intent: "missing_connector",
          suggestedConnector: "hubspot",
          message:
            "This employee is set up for HubSpot, but HubSpot isn't connected. Connect it under Connections, then say **start work**.",
        };
      }
      return {
        intent: "work",
        shouldStartWork: true,
        message: `This looks like CRM work. Starting ${name}'s workflow — approve any write steps when asked.`,
      };
    }
    return {
      intent: "missing_connector",
      suggestedConnector: "hubspot",
      message:
        "I don't have HubSpot on this employee's steps. Connect HubSpot under Connections, then ask me to add CRM steps — or hire a sales employee that includes them.",
    };
  }

  return {
    intent: "chat",
    message: `I'm ${name}. ${purpose}\n\nI can run my assigned workflow when you say **start work**, answer what I'm set up to do, or help you change steps and schedule.\n\nWhat would you like?`,
  };
}
