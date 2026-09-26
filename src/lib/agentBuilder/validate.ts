/**
 * Validate AI-proposed workflows against the connector/action registry.
 * Never trust model output for availability or permissions.
 */

import { getAction, catalogActions } from "@/lib/actionRegistry";
import { getConnector } from "@/lib/connectors/registry";
import type {
  AgentProposal,
  ValidatedProposal,
  ValidationIssue,
  ProposedStep,
} from "./types";

export function validateProposal(raw: unknown): ValidatedProposal {
  const issues: ValidationIssue[] = [];
  const proposal = normalizeProposal(raw, issues);

  const required = new Map<string, { id: string; name: string; status: string }>();
  const approvalSteps: string[] = [];
  const validSteps: ProposedStep[] = [];

  for (const step of proposal.steps) {
    const def = getAction(step.actionId);
    if (!def) {
      issues.push({
        code: "unknown_action",
        message: `Action "${step.actionId}" is not in Nexa's registry.`,
        severity: "error",
        actionId: step.actionId,
      });
      continue;
    }

    const connector = getConnector(def.connectionId || "");
    if (def.connectionId && connector) {
      const status =
        connector.defaultStatus === "connected"
          ? "connected"
          : connector.defaultStatus === "coming_soon"
            ? "coming_soon"
            : connector.executable && def.implemented
              ? "available"
              : "unavailable";
      required.set(connector.id, {
        id: connector.id,
        name: connector.name,
        status,
      });
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
          message: `Step "${def.name}" needs "${f.label}". You can fill it after creating a draft.`,
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

  proposal.steps = validSteps;

  if (!proposal.name.trim()) {
    issues.push({
      code: "name_required",
      message: "Agent name is required.",
      severity: "error",
    });
  }

  if (proposal.steps.length === 0) {
    issues.push({
      code: "no_steps",
      message: "No valid workflow steps. Describe what the agent should do with available tools.",
      severity: "error",
    });
  }

  const hardErrors = issues.filter((i) => i.severity === "error");
  const canActivate =
    hardErrors.length === 0 &&
    proposal.steps.every((s) => {
      const d = getAction(s.actionId);
      return d?.implemented && d.available;
    });

  return {
    proposal,
    issues,
    canActivate,
    canDraft: Boolean(proposal.name.trim()) && proposal.steps.length > 0,
    requiredConnectors: Array.from(required.values()),
    approvalSteps,
  };
}

function normalizeProposal(raw: unknown, issues: ValidationIssue[]): AgentProposal {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sched = (o.schedule && typeof o.schedule === "object"
    ? o.schedule
    : {}) as Record<string, unknown>;

  const freq = String(sched.frequency || o.trigger === "schedule" ? sched.frequency || "daily" : "once");
  const frequency =
    freq === "daily" || freq === "weekly" || freq === "monthly" ? freq : "once";

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
      message: "Model did not return a steps array.",
      severity: "error",
    });
  }

  return {
    name: String(o.name || "Untitled agent").slice(0, 80),
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
