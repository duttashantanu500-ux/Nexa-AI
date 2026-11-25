/**
 * Composio connected-account helpers (REST only).
 * Enforces max 3 active connected accounts per Nexa user.
 */

import { MAX_COMPOSIO_CONNECTIONS } from "@/lib/plans";
import { composioFetch, composioUserId } from "./client";

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
  return (
    s === "ACTIVE" ||
    s === "CONNECTED" ||
    s === "ENABLED" ||
    s === "SUCCESS" ||
    s === "INITIATED"
  );
}

function mapAccount(a: any): ComposioAccountView {
  return {
    id: String(a.id || a.nanoid || ""),
    toolkit: String(
      a.toolkit?.slug ||
        a.appName ||
        a.appUniqueId ||
        a.toolkit_slug ||
        a.app_name ||
        "unknown"
    ).toLowerCase(),
    status: String(a.status || "UNKNOWN"),
    createdAt: a.createdAt || a.created_at,
    isDisabled: Boolean(a.isDisabled ?? a.is_disabled),
  };
}

export async function listUserAccounts(
  nexaUserId: string
): Promise<ComposioAccountView[]> {
  const userId = composioUserId(nexaUserId);
  if (!userId) return [];

  const res = await composioFetch(
    `/connected_accounts?user_ids=${encodeURIComponent(userId)}&limit=50`
  );
  const items =
    res.data?.items ||
    res.data?.data ||
    res.data?.connected_accounts ||
    (Array.isArray(res.data) ? res.data : []);
  if (!Array.isArray(items)) return [];
  return items.map(mapAccount);
}

export async function countActiveConnections(
  nexaUserId: string
): Promise<number> {
  const accounts = await listUserAccounts(nexaUserId);
  return accounts.filter((a) => isActiveStatus(a.status, a.isDisabled)).length;
}

export async function assertCanAddConnection(
  nexaUserId: string
): Promise<
  { ok: true; used: number } | { ok: false; message: string; used: number }
> {
  let used = 0;
  try {
    used = await countActiveConnections(nexaUserId);
  } catch {
    used = 0;
  }
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
