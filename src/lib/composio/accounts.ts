/**
 * Composio connected-account helpers (server-only).
 * Enforces max 3 active connected accounts per Nexa user.
 */

import { MAX_COMPOSIO_CONNECTIONS } from "@/lib/plans";
import { composioUserId, getComposio } from "./client";

export type ComposioAccountView = {
  id: string;
  toolkit: string;
  status: string;
  createdAt?: string;
  isDisabled?: boolean;
};

function isActiveStatus(status: string, isDisabled?: boolean): boolean {
  if (isDisabled) return false;
  const s = String(status || "").toUpperCase();
  return s === "ACTIVE" || s === "CONNECTED" || s === "ENABLED" || s === "SUCCESS";
}

export async function listUserAccounts(
  nexaUserId: string
): Promise<ComposioAccountView[]> {
  const userId = composioUserId(nexaUserId);
  if (!userId) return [];
  const composio = getComposio();
  const res = await composio.connectedAccounts.list({
    userIds: [userId],
  } as any);
  const items = (res as any)?.items || (res as any)?.data || [];
  return (Array.isArray(items) ? items : []).map((a: any) => ({
    id: String(a.id || ""),
    toolkit: String(a.toolkit?.slug || a.appName || a.appUniqueId || "unknown"),
    status: String(a.status || "UNKNOWN"),
    createdAt: a.createdAt || a.created_at,
    isDisabled: Boolean(a.isDisabled),
  }));
}

export async function countActiveConnections(nexaUserId: string): Promise<number> {
  const accounts = await listUserAccounts(nexaUserId);
  return accounts.filter((a) => isActiveStatus(a.status, a.isDisabled)).length;
}

export async function assertCanAddConnection(
  nexaUserId: string
): Promise<{ ok: true; used: number } | { ok: false; message: string; used: number }> {
  const used = await countActiveConnections(nexaUserId);
  if (used >= MAX_COMPOSIO_CONNECTIONS) {
    return {
      ok: false,
      used,
      message: `You already have ${used} of ${MAX_COMPOSIO_CONNECTIONS} connected accounts. Disconnect one to free a slot.`,
    };
  }
  return { ok: true, used };
}

export { MAX_COMPOSIO_CONNECTIONS };
