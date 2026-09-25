/**
 * Phase 7: simple per-connector client rate limiting (best-effort in browser).
 * Server-side connectors should enforce provider limits separately.
 */

const buckets = new Map<string, { tokens: number; updated: number }>();

export const CONNECTOR_LIMITS: Record<
  string,
  { requestsPerMinute: number; burst: number }
> = {
  slack: { requestsPerMinute: 20, burst: 5 },
  notion: { requestsPerMinute: 30, burst: 5 },
  github: { requestsPerMinute: 30, burst: 5 },
  local_data: { requestsPerMinute: 120, burst: 20 },
  local_comfyui: { requestsPerMinute: 10, burst: 2 },
};

export function takeToken(connectorId: string): { ok: boolean; retryAfterMs?: number } {
  const policy = CONNECTOR_LIMITS[connectorId] || {
    requestsPerMinute: 60,
    burst: 10,
  };
  const now = Date.now();
  let b = buckets.get(connectorId);
  if (!b) {
    b = { tokens: policy.burst, updated: now };
    buckets.set(connectorId, b);
  }
  const elapsed = (now - b.updated) / 1000;
  const refill = (policy.requestsPerMinute / 60) * elapsed;
  b.tokens = Math.min(policy.burst, b.tokens + refill);
  b.updated = now;
  if (b.tokens < 1) {
    const retryAfterMs = Math.ceil((1 - b.tokens) * (60 / policy.requestsPerMinute) * 1000);
    return { ok: false, retryAfterMs };
  }
  b.tokens -= 1;
  return { ok: true };
}
