/**
 * Phase 6: {{stepId.output.field}} and {{stepId.output}} resolution.
 */

import type { WorkflowStep } from "@/types";

const REF_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\.output(?:\.([a-zA-Z0-9_]+))?\s*\}\}/g;

export function listUpstreamRefs(steps: WorkflowStep[], beforeIndex: number): string[] {
  const refs: string[] = [];
  for (let i = 0; i < beforeIndex; i++) {
    const s = steps[i];
    const key = s.outputKey || s.id;
    refs.push(`{{${key}.output}}`);
    refs.push(`{{${key}.output.list}}`);
    refs.push(`{{${key}.output.count}}`);
    refs.push(`{{${key}.output.message}}`);
  }
  return refs;
}

export function extractRefs(value: string): string[] {
  const found: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(REF_RE.source, "g");
  while ((m = re.exec(value)) !== null) {
    found.push(m[0]);
  }
  return found;
}

/** Validate that all mapping refs point to earlier steps */
export function validateMappings(
  steps: WorkflowStep[]
): { ok: boolean; issues: { stepId: string; message: string }[] } {
  const issues: { stepId: string; message: string }[] = [];
  const knownKeys = new Set<string>();

  const ordered = [...steps].sort((a, b) => a.order - b.order);
  for (const step of ordered) {
    const values = [
      ...Object.values(step.config || {}),
      ...Object.values(step.inputMapping || {}),
    ];
    for (const v of values) {
      if (!v || typeof v !== "string") continue;
      const re = new RegExp(REF_RE.source, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(v)) !== null) {
        const refKey = m[1];
        if (!knownKeys.has(refKey)) {
          issues.push({
            stepId: step.id,
            message: `Unknown mapping ref ${m[0]} — step must come after the referenced step.`,
          });
        }
      }
    }
    knownKeys.add(step.outputKey || step.id);
  }
  return { ok: issues.length === 0, issues };
}

function getByPath(obj: unknown, path?: string): unknown {
  if (path == null || path === "") return obj;
  if (obj == null || typeof obj !== "object") return undefined;
  return (obj as Record<string, unknown>)[path];
}

export function resolveTemplate(
  template: string,
  stepOutputs: Record<string, unknown>
): string {
  return template.replace(REF_RE, (_, key: string, field?: string) => {
    const raw = stepOutputs[key];
    const val = field ? getByPath(raw, field) : raw;
    if (val == null) return "";
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (Array.isArray(val)) return val.join("\n");
    try {
      return JSON.stringify(val);
    } catch {
      return "";
    }
  });
}

export function resolveConfig(
  config: Record<string, string>,
  inputMapping: Record<string, string> | undefined,
  stepOutputs: Record<string, unknown>
): Record<string, string> {
  const merged = { ...config, ...(inputMapping || {}) };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) {
    out[k] = resolveTemplate(String(v ?? ""), stepOutputs);
  }
  return out;
}
