/**
 * Validate agent proposals and persisted agent shapes (user-facing messages use employee language).
 */

export type ValidationIssue = {
  code: string;
  message: string;
  field?: string;
};

export function validateAgentName(name: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof name !== "string" || !name.trim()) {
    issues.push({ code: "name_required", message: "Employee name is required." });
  } else if (name.trim().length > 80) {
    issues.push({ code: "name_too_long", message: "Employee name is too long." });
  }
  return issues;
}
