/**
 * Server-side plan gates for OAuth connect and other API routes.
 * Real limits from billing snapshot + token store — no mocks.
 */

import { getBillingSnapshot, ensureFreeSubscription } from "@/lib/billing";
import { LIMIT_MESSAGES } from "@/lib/plans";
import { loadAllConnectionsForUser } from "@/lib/connectors/tokenStore";
import { getMcpConnection } from "@/lib/connectors/mcpAuth";

const EXTERNAL = [
  "notion",
  "slack",
  "buffer",
  "hubspot",
  "ideogram",
  "vapi",
  "mcp",
] as const;

export async function countExternalConnections(
  userId: string
): Promise<number> {
  const all = await loadAllConnectionsForUser(userId);
  let n = 0;
  for (const id of EXTERNAL) {
    if (id === "mcp") {
      if (await getMcpConnection(userId)) n += 1;
    } else if (all.get(id)?.accessToken) {
      n += 1;
    }
  }
  return n;
}

/**
 * Allow reconnect of an already-connected provider.
 * Block only when adding a *new* connection would exceed the plan.
 */
export async function assertCanAddConnection(
  userId: string,
  connectorId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!userId) {
    return { ok: false, message: "Please sign in." };
  }

  const all = await loadAllConnectionsForUser(userId);
  if (connectorId === "mcp") {
    if (await getMcpConnection(userId)) return { ok: true };
  } else if (all.get(connectorId)?.accessToken) {
    return { ok: true }; // reconnect / already connected
  }

  await ensureFreeSubscription(userId);
  const snap = await getBillingSnapshot(userId);
  const max = snap.limits.maxConnections;
  if (max === Number.POSITIVE_INFINITY) return { ok: true };

  const count = await countExternalConnections(userId);
  if (count >= max) {
    return { ok: false, message: LIMIT_MESSAGES.connections };
  }
  return { ok: true };
}
