/** Normalized result from a provider call. Never invent success. */

export interface ProviderResult {
  ok: boolean;
  /** Human summary for UI */
  message: string;
  /** Raw-ish payload for run history (secrets already redacted) */
  data?: unknown;
  error?: {
    category: "auth" | "rate_limit" | "validation" | "server_error" | "not_configured" | "unknown";
    providerStatusCode?: number;
    providerMessage?: string;
  };
}

export function notConfigured(provider: string, action: string): ProviderResult {
  return {
    ok: false,
    message: `${provider} is not configured for "${action}". Add OAuth credentials and a stored connection token first.`,
    error: {
      category: "not_configured",
      providerMessage: "No access token / OAuth app on this deployment",
    },
  };
}
