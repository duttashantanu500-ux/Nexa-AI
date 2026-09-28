/**
 * Per-user Ideogram API key resolution (never sent to the browser).
 */

import {
  loadConnection,
  saveConnection,
  deleteConnection,
  type StoredConnection,
} from "./tokenStore";

export async function resolveIdeogramToken(
  userId: string
): Promise<{ token: string; meta: StoredConnection } | null> {
  const conn = await loadConnection(userId, "ideogram");
  if (!conn?.accessToken) return null;
  return { token: conn.accessToken, meta: conn };
}

export async function saveIdeogramKey(
  userId: string,
  apiKey: string
): Promise<{ ok: boolean; message?: string }> {
  const key = apiKey.trim();
  if (!key) return { ok: false, message: "Please paste your Ideogram access key." };
  try {
    await saveConnection({
      userId,
      connectorId: "ideogram",
      accessToken: key,
      workspaceName: "Ideogram",
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not save your Ideogram connection." };
  }
}

export async function removeIdeogramConnection(userId: string): Promise<void> {
  await deleteConnection(userId, "ideogram");
}
