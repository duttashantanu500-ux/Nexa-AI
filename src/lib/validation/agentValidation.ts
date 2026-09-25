/**
 * Structural + mapping validation before activating an agent.
 */

import { getAction } from "@/lib/actionRegistry";
import { validateMappings } from "@/lib/mapping";
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
    if (type !== "action") continue;

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
    if (!def.available || !def.implemented) {
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

  const mapCheck = validateMappings(steps);
  for (const i of mapCheck.issues) {
    issues.push({ code: "mapping_error", message: i.message, stepId: i.stepId });
  }

  return { ok: issues.length === 0, issues };
}

export function canActivateAgent(agent: Agent): boolean {
  return validateAgentStructure(agent).ok;
}
