/**
 * Per-user Vapi private API key resolution (never sent to the browser).
 */

import {
  loadConnection,
  saveConnection,
  deleteConnection,
  type StoredConnection,
} from "./tokenStore";

export async function resolveVapiToken(
  userId: string
): Promise<{ token: string; meta: StoredConnection } | null> {
  const conn = await loadConnection(userId, "vapi");
  if (!conn?.accessToken) return null;
  return { token: conn.accessToken, meta: conn };
}

export async function saveVapiKey(
  userId: string,
  apiKey: string
): Promise<{ ok: boolean; message?: string }> {
  const key = apiKey.trim();
  if (!key) return { ok: false, message: "Please paste your Vapi private API key." };
  try {
    await saveConnection({
      userId,
      connectorId: "vapi",
      accessToken: key,
      workspaceName: "Vapi",
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not save your Vapi connection." };
  }
}

export async function removeVapiConnection(userId: string): Promise<void> {
  await deleteConnection(userId, "vapi");
}
