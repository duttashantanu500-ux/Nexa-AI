/**
 * Phase 7: never persist secrets in run history or logs.
 */

const SENSITIVE_KEY =
  /^(authorization|access_token|refresh_token|token|password|secret|api[_-]?key|client_secret|bearer)$/i;

const BEARER_RE = /Bearer\s+[A-Za-z0-9._\-]+/gi;
const LONG_TOKEN_RE = /\b[A-Za-z0-9_\-]{32,}\b/g;

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(BEARER_RE, "Bearer [REDACTED]")
      .replace(LONG_TOKEN_RE, (m) => (m.length > 40 ? "[REDACTED]" : m));
  }
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function redactStepResult<T extends Record<string, unknown>>(step: T): T {
  return {
    ...step,
    inputSent: redactValue(step.inputSent),
    outputReceived: redactValue(step.outputReceived),
    output:
      typeof step.output === "string"
        ? (redactValue(step.output) as string)
        : step.output,
    error:
      typeof step.error === "string"
        ? (redactValue(step.error) as string)
        : step.error,
  };
}
