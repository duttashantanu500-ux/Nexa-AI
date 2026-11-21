/**
 * Validate AI-proposed workflows against the connector/action registry.
 * Never trust model output for availability or permissions.
 * Uses live connection status when provided so the UI can warn about
 * connectors that are not connected yet.
 */

import { getAction, catalogActions } from "@/lib/actionRegistry";
import { getConnector } from "@/lib/connectors/registry";
import type {
  AgentProposal,
  ValidatedProposal,
  ValidationIssue,
  ProposedStep,
} from "./types";

/** Map free-text / bad model actionIds to real registry IDs */
function repairStepActionId(actionId: string, name: string): string {
  const a = (actionId || "").toLowerCase().trim();
  const n = (name || "").toLowerCase().trim();
  const blob = `${a} ${n}`;

  if (actionId && getAction(actionId)) return actionId;

  // Slack
  if (/slack/.test(blob) && /(list|channel)/.test(blob)) return "slack.list_channels";
  if (/slack/.test(blob) && /(post|send|message|deliver)/.test(blob)) return "slack.post_message";
  if (/slack/.test(blob) && /(summar|read|fetch|get)/.test(blob)) return "slack.list_channels";
  if (/slack/.test(blob)) return "slack.post_message";

  // Notion
  if (/notion/.test(blob) && /(search|find|query)/.test(blob)) return "notion.search";
  if (/notion/.test(blob) && /(create|post|write|page|summary)/.test(blob)) return "notion.create_page";
  if (/notion/.test(blob)) return "notion.create_page";

  // HubSpot
  if (/hubspot|crm/.test(blob) && /deal/.test(blob) && /search|filter|need/.test(blob)) return "hubspot.search_deals";
  if (/hubspot|crm/.test(blob) && /deal/.test(blob)) return "hubspot.list_deals";
  if (/hubspot|crm/.test(blob) && /contact/.test(blob)) return "hubspot.list_contacts";
  if (/hubspot|crm/.test(blob) && /compan/.test(blob)) return "hubspot.list_companies";
  if (/hubspot|crm/.test(blob)) return "hubspot.list_deals";

  // Buffer
  if (/buffer|social/.test(blob) && /(list|channel)/.test(blob)) return "buffer.list_channels";
  if (/buffer|social|linkedin|twitter|post/.test(blob)) return "buffer.create_post";

  // Local
  if (/(list|load).*(text|item)/.test(blob) || /local_data\.list/.test(a)) return "local_data.list_from_text";
  if (/filter/.test(blob)) return "local_data.filter";
  if (/report/.test(blob)) return "local_data.report";
  if (/note/.test(blob) && /local|brief|capture/.test(blob)) return "local_data.note";

  // MCP
  if (/mcp|custom tool/.test(blob)) return "mcp.call_tool";

  return actionId;
}

export function validateProposal(
  proposal: AgentProposal,
  connectionStatuses?: Record<string, string>
): ValidatedProposal {
  const issues: ValidationIssue[] = [];
  const approvalSteps: string[] = [];
  let validSteps: ProposedStep[] = [];

  for (const raw of proposal.steps || []) {
    const step = { ...raw, actionId: repairStepActionId(raw.actionId, raw.name || "") };
    const def = getAction(step.actionId);
    if (!def) {
      issues.push({
        code: "unknown_action",
        message: `Unknown step "${step.actionId}". Choose a supported action.`,
        severity: "error",
        actionId: step.actionId,
      });
      continue;
    }

    const connector = getConnector(def.connectionId || "");
    if (connector) {
      const status = connectionStatuses?.[connector.id];
      if (status === "unavailable" || status === "coming_soon") {
        issues.push({
          code: "connector_unavailable",
          message: `${connector.name} is coming soon — this step cannot run yet.`,
          severity: "warning",
          actionId: step.actionId,
        });
      } else if (
        status !== "connected" &&
        connector.id !== "local_data" &&
        connector.id !== "vault"
      ) {
        issues.push({
          code: "connector_not_connected",
          message: `${connector.name} is not connected. Connect it under Connections before this step can run live.`,
          severity: "warning",
          actionId: step.actionId,
        });
      }
    }

    if (!def.implemented || !def.available) {
      issues.push({
        code: "action_unavailable",
        message:
          def.availabilityNote ||
          `"${def.name}" is not available yet (${def.connectionId || "unknown"}).`,
        severity: "error",
        actionId: step.actionId,
      });
    }

    for (const f of def.fields) {
      if (!f.required) continue;
      const v = step.config?.[f.key];
      if (!String(v ?? "").trim()) {
        issues.push({
          code: "missing_field",
          message: `"${def.name}" still needs a ${f.label.toLowerCase()}. You can set it in chat before starting work.`,
          severity: "warning",
          actionId: step.actionId,
        });
      }
    }

    if (def.requiresApproval || step.requiresApproval) {
      approvalSteps.push(def.name);
    }

    validSteps.push({
      actionId: def.id,
      name: def.name,
      config: step.config || {},
      requiresApproval: def.requiresApproval,
      onError: step.onError || "stop",
    });
  }

  const roleBlob = `${proposal.name} ${proposal.description} ${proposal.purpose || ""}`.toLowerCase();
  if (/marketing/.test(roleBlob)) {
    const hasNote = validSteps.some((s) => s.actionId === "local_data.note");
    const hasReport = validSteps.some((s) => s.actionId === "local_data.report");
    const prefix: ProposedStep[] = [];
    if (!hasNote) {
      prefix.push({
        actionId: "local_data.note",
        name: "Add note",
        config: {},
        requiresApproval: false,
        onError: "stop",
      });
    }
    if (!hasReport) {
      prefix.push({
        actionId: "local_data.report",
        name: "Report",
        config: { title: "Marketing summary" },
        requiresApproval: false,
        onError: "stop",
      });
    }
    if (prefix.length) {
      validSteps = [...prefix, ...validSteps];
    }
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  return {
    ...proposal,
    steps: validSteps,
    issues,
    approvalSteps,
    ok: !hasErrors && validSteps.length > 0,
  };
}

export function normalizeProposal(raw: unknown, issues: ValidationIssue[]): AgentProposal {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sched = (o.schedule && typeof o.schedule === "object"
    ? o.schedule
    : {}) as Record<string, unknown>;

  let frequency: "once" | "daily" | "weekly" | "monthly" = "once";
  const rawFreq = String(sched.frequency || "");
  if (rawFreq === "daily" || rawFreq === "weekly" || rawFreq === "monthly") {
    frequency = rawFreq;
  } else if (o.trigger === "schedule") {
    frequency = "daily";
  }

  const stepsRaw = Array.isArray(o.steps) ? o.steps : [];
  const steps: ProposedStep[] = stepsRaw.map((s) => {
    const st = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const config =
      st.config && typeof st.config === "object"
        ? Object.fromEntries(
            Object.entries(st.config as Record<string, unknown>).map(([k, v]) => [
              k,
              String(v ?? ""),
            ])
          )
        : {};
    return {
      actionId: String(st.actionId || ""),
      name: st.name ? String(st.name) : undefined,
      config,
      requiresApproval: Boolean(st.requiresApproval),
      onError:
        st.onError === "continue" || st.onError === "retry" ? st.onError : "stop",
    };
  });

  if (!Array.isArray(o.steps)) {
    issues.push({
      code: "invalid_shape",
      message: "Could not build steps for this employee. Try describing the role again.",
      severity: "error",
    });
  }

  return {
    name: String(o.name || "Untitled employee").slice(0, 80),
    description: String(o.description || "").slice(0, 400),
    purpose: o.purpose ? String(o.purpose).slice(0, 400) : undefined,
    trigger: frequency === "once" ? "manual" : "schedule",
    schedule: {
      frequency,
      time: String(sched.time || "09:00"),
      timezone: String(sched.timezone || "UTC"),
      enabled: frequency !== "once",
    },
    steps,
    notes: o.notes ? String(o.notes).slice(0, 500) : undefined,
  };
}

/** Catalog summary injected into the builder system prompt */
export function registryCatalogForPrompt(): string {
  const lines: string[] = [];
  for (const a of catalogActions()) {
    const fields = a.fields
      .map((f) => `${f.key}${f.required ? "*" : ""}`)
      .join(", ");
    lines.push(
      `- ${a.id} | ${a.name} | connector=${a.connectionId || "none"} | implemented=${a.implemented} | readOnly=${a.readOnly} | approval=${a.requiresApproval} | fields=[${fields}]`
    );
  }
  return lines.join("\n");
}
