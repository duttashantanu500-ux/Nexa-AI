/**
 * Server-only Composio client.
 * COMPOSIO_API_KEY stays on the server — never send to the browser or into prompts.
 *
 * Billing note: Nexa uses one Composio project API key. Tool executions and
 * connected accounts are billed against that project. Set usage alerts in the
 * Composio dashboard. Do not assume per-customer Composio billing unless you
 * configure a separate arrangement.
 */

import { Composio } from "@composio/core";

let cached: Composio | null = null;

export function composioConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY?.trim());
}

export function getComposio(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Composio is not configured. Set COMPOSIO_API_KEY in the server environment."
    );
  }
  if (!cached) {
    cached = new Composio({ apiKey });
  }
  return cached;
}

/** Map Nexa user id → Composio userId (1:1 isolation). */
export function composioUserId(nexaUserId: string): string {
  return String(nexaUserId || "").trim();
}
