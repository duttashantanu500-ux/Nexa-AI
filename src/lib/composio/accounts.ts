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

async function listViaRest(userId: string): Promise<ComposioAccountView[]> {
  const key = process.env.COMPOSIO_API_KEY?.trim() || "";
  if (!key) return [];
  const bases = [
    "https://backend.composio.dev/api/v3.1",
    "https://backend.composio.dev/api/v3",
  ];
  for (const base of bases) {
    try {
      const url = `${base}/connected_accounts?user_ids=${encodeURIComponent(userId)}&limit=50`;
      const res = await fetch(url, {
        headers: { "x-api-key": key, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json().catch(() => ({}));
      const items = data.items || data.data || data.connected_accounts || [];
      if (Array.isArray(items)) return items.map(mapAccount);
    } catch {
      /* next */
    }
  }
  return [];
}

export async function listUserAccounts(
  nexaUserId: string
): Promise<ComposioAccountView[]> {
  const userId = composioUserId(nexaUserId);
  if (!userId) return [];

  try {
    const composio = getComposio() as any;
    const res = await composio.connectedAccounts.list({
      userIds: [userId],
      user_ids: [userId],
    });
    const items = (res as any)?.items || (res as any)?.data || [];
    if (Array.isArray(items) && items.length) {
      return items.map(mapAccount);
    }
  } catch {
    /* REST fallback */
  }

  return listViaRest(userId);
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
