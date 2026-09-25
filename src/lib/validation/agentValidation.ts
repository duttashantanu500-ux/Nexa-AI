/**
 * Structural validation before marking an agent active/runnable.
 * Does not call external providers.
 */

import { getAction } from "@/lib/actionRegistry";
import type { Agent, WorkflowStep } from "@/types";

export interface ValidationIssue {
  code: string;
  message: string;
  stepId?: string;
}

export function validateAgentStructure(agent: {
  name?: string;
  steps?: WorkflowStep[];
}): { ok: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (!agent.name?.trim()) {
    issues.push({ code: "name_required", message: "Agent name is required." });
  }

  const steps = agent.steps || [];
  if (steps.length === 0) {
    issues.push({
      code: "no_steps",
      message: "Add at least one step before activating.",
    });
  }

  for (const step of steps) {
    const type = step.type || "action";
    if (type === "action") {
      if (!step.actionId) {
        issues.push({
          code: "missing_action",
          message: "Step is missing an action.",
          stepId: step.id,
        });
        continue;
      }
      const def = getAction(step.actionId);
      if (!def) {
        issues.push({
          code: "unknown_action",
          message: `Unknown action: ${step.actionId}`,
          stepId: step.id,
        });
        continue;
      }
      if (!def.available) {
        issues.push({
          code: "action_not_implemented",
          message:
            def.availabilityNote ||
            `Action ${def.name} is not implemented yet.`,
          stepId: step.id,
        });
      }
      for (const f of def.fields) {
        if (!f.required) continue;
        const fromConfig = step.config?.[f.key];
        const fromMap = step.inputMapping?.[f.key];
        if (!String(fromConfig ?? fromMap ?? "").trim()) {
          issues.push({
            code: "required_field",
            message: `Missing required field "${f.label}" on step ${step.name || step.actionId}.`,
            stepId: step.id,
          });
        }
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export function canActivateAgent(agent: Agent): boolean {
  return validateAgentStructure(agent).ok;
}
