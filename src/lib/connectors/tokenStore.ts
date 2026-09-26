/**
 * Server-side OAuth token storage for connectors.
 * Tokens never go to the browser. Encrypted at rest when possible.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

export type ConnectorId = "notion" | "slack" | "github";

export interface StoredConnection {
  userId: string;
  connectorId: ConnectorId;
  accessToken: string;
  refreshToken?: string;
  workspaceName?: string;
  workspaceId?: string;
  botId?: string;
  scopes?: string[];
  connectedAt: string;
  lastVerifiedAt?: string;
}

function encryptionKey(): Buffer {
  const secret =
    process.env.CONNECTOR_TOKEN_SECRET ||
    process.env.NOTION_CLIENT_SECRET ||
    process.env.SLACK_CLIENT_SECRET ||
    "nexa-dev-only-change-me";
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** In-memory fallback for local/dev when Supabase is absent (per instance). */
const memory = new Map<string, string>();

function memKey(userId: string, connectorId: string) {
  return `${userId}::${connectorId}`;
}

export async function saveConnection(conn: StoredConnection): Promise<{ ok: boolean; error?: string }> {
  const encrypted = encryptSecret(
    JSON.stringify({
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken,
      workspaceName: conn.workspaceName,
      workspaceId: conn.workspaceId,
      botId: conn.botId,
      scopes: conn.scopes,
      connectedAt: conn.connectedAt,
      lastVerifiedAt: conn.lastVerifiedAt,
    })
  );

  const sb = adminClient();
  if (sb) {
    const { error } = await sb.from("nexa_oauth_tokens").upsert(
      {
        user_id: conn.userId,
        connector_id: conn.connectorId,
        ciphertext: encrypted,
        workspace_name: conn.workspaceName || null,
        workspace_id: conn.workspaceId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,connector_id" }
    );
    if (error) {
      // Fall through to memory if table missing
      memory.set(memKey(conn.userId, conn.connectorId), encrypted);
      return { ok: true, error: `supabase_upsert_failed_using_memory: ${error.message}` };
    }
    return { ok: true };
  }

  memory.set(memKey(conn.userId, conn.connectorId), encrypted);
  return { ok: true };
}

export async function getConnection(
  userId: string,
  connectorId: ConnectorId
): Promise<StoredConnection | null> {
  let ciphertext: string | null = null;

  const sb = adminClient();
  if (sb) {
    const { data } = await sb
      .from("nexa_oauth_tokens")
      .select("ciphertext")
      .eq("user_id", userId)
      .eq("connector_id", connectorId)
      .maybeSingle();
    if (data?.ciphertext) ciphertext = data.ciphertext;
  }

  if (!ciphertext) {
    ciphertext = memory.get(memKey(userId, connectorId)) || null;
  }
  if (!ciphertext) return null;

  try {
    const parsed = JSON.parse(decryptSecret(ciphertext)) as Omit<
      StoredConnection,
      "userId" | "connectorId"
    >;
    return {
      userId,
      connectorId,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      workspaceName: parsed.workspaceName,
      workspaceId: parsed.workspaceId,
      botId: parsed.botId,
      scopes: parsed.scopes,
      connectedAt: parsed.connectedAt,
      lastVerifiedAt: parsed.lastVerifiedAt,
    };
  } catch {
    return null;
  }
}

export async function deleteConnection(
  userId: string,
  connectorId: ConnectorId
): Promise<void> {
  memory.delete(memKey(userId, connectorId));
  const sb = adminClient();
  if (sb) {
    await sb
      .from("nexa_oauth_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("connector_id", connectorId);
  }
}

export async function touchVerified(userId: string, connectorId: ConnectorId): Promise<void> {
  const conn = await getConnection(userId, connectorId);
  if (!conn) return;
  conn.lastVerifiedAt = new Date().toISOString();
  await saveConnection(conn);
}

/** Sign oauth state: userId.timestamp.signature */
export function signOAuthState(userId: string): string {
  const ts = Date.now().toString(36);
  const payload = `${userId}.${ts}`;
  const sig = createHash("sha256")
    .update(payload + encryptionKey().toString("hex"))
    .digest("base64url")
    .slice(0, 16);
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string | null): string | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length < 3) return null;
  const [userId, ts, sig] = parts;
  const payload = `${userId}.${ts}`;
  const expected = createHash("sha256")
    .update(payload + encryptionKey().toString("hex"))
    .digest("base64url")
    .slice(0, 16);
  if (sig !== expected) return null;
  const age = Date.now() - parseInt(ts, 36);
  if (Number.isNaN(age) || age > 15 * 60 * 1000) return null;
  return userId;
}
