/**
 * Server-side OAuth token storage for connectors.
 * Tokens never go to the browser. Encrypted at rest.
 *
 * When Supabase is configured, tokens MUST be written to nexa_oauth_tokens.
 * In-memory storage is only used when Supabase is not configured (local dev).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

export type ConnectorId =
  | "notion"
  | "slack"
  | "github"
  | "buffer"
  | "ideogram"
  | "mcp"
  | "hubspot";

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
    process.env.BUFFER_CLIENT_SECRET ||
    process.env.HUBSPOT_CLIENT_SECRET ||
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

/** Strip trailing slash / path and validate Project URL shape. */
function normalizeSupabaseUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  let u = raw.trim().replace(/\/+$/, "");
  if (u.includes("supabase.com/dashboard")) return null;
  if (u.includes("/rest/v1")) u = u.split("/rest/v1")[0].replace(/\/+$/, "");
  if (u.startsWith("postgres://") || u.startsWith("postgresql://")) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function supabaseAdmin() {
  const url =
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    normalizeSupabaseUrl(process.env.NEXT_SUPABASE_URL);
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseUrlHint(): string | null {
  const url =
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    normalizeSupabaseUrl(process.env.NEXT_SUPABASE_URL);
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function hasServiceRoleKey(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

const memory = new Map<string, string>();

function memKey(userId: string, connectorId: string) {
  return `${userId}::${connectorId}`;
}

export type StorageHealth =
  | { ok: true; mode: "supabase" | "memory" }
  | {
      ok: false;
      reason: "no_supabase" | "missing_table" | "rls_or_permission" | "bad_config" | "unknown";
      detail?: string;
    };

function classifyStorageError(message: string, code?: string): StorageHealth {
  const msg = (message || "").toLowerCase();
  if (code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache")) {
    return { ok: false, reason: "missing_table", detail: message };
  }
  if (code === "42501" || msg.includes("permission") || msg.includes("rls") || msg.includes("policy")) {
    return { ok: false, reason: "rls_or_permission", detail: message };
  }
  if (msg.includes("invalid") || msg.includes("url") || msg.includes("fetch failed")) {
    return { ok: false, reason: "bad_config", detail: message };
  }
  return { ok: false, reason: "unknown", detail: message };
}

export async function checkStorageHealth(): Promise<StorageHealth> {
  const admin = supabaseAdmin();
  if (!admin) {
    return { ok: true, mode: "memory" };
  }
  try {
    const { error } = await admin.from("nexa_oauth_tokens").select("user_id").limit(1);
    if (error) return classifyStorageError(error.message, (error as { code?: string }).code);
    return { ok: true, mode: "supabase" };
  } catch (e) {
    return classifyStorageError(e instanceof Error ? e.message : "unknown");
  }
}

/** Alias used by storage-health route */
export const checkTokenStorageHealth = checkStorageHealth;

export async function saveConnection(
  conn: StoredConnection
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = supabaseAdmin();
  let encrypted: string;
  try {
    encrypted = encryptSecret(
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "encrypt_failed";
    console.error("[tokenStore] encrypt failed", msg);
    return { ok: false, error: msg };
  }

  if (admin) {
    const { error } = await admin.from("nexa_oauth_tokens").upsert(
      {
        user_id: conn.userId,
        connector_id: conn.connectorId,
        ciphertext: encrypted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,connector_id" }
    );
    if (error) {
      console.error("[tokenStore] saveConnection failed", error.message);
      memory.set(memKey(conn.userId, conn.connectorId), encrypted);
      return { ok: false, error: error.message };
    }
    memory.set(memKey(conn.userId, conn.connectorId), encrypted);
    return { ok: true };
  }

  memory.set(memKey(conn.userId, conn.connectorId), encrypted);
  return { ok: true };
}

export async function loadConnection(
  userId: string,
  connectorId: ConnectorId
): Promise<StoredConnection | null> {
  const admin = supabaseAdmin();
  let encrypted: string | undefined;

  if (admin) {
    const { data, error } = await admin
      .from("nexa_oauth_tokens")
      .select("ciphertext")
      .eq("user_id", userId)
      .eq("connector_id", connectorId)
      .maybeSingle();
    if (error) {
      console.error("[tokenStore] loadConnection failed", error.message);
    } else if (data?.ciphertext) {
      encrypted = data.ciphertext as string;
    }
  }

  if (!encrypted) encrypted = memory.get(memKey(userId, connectorId));
  if (!encrypted) return null;

  try {
    const parsed = JSON.parse(decryptSecret(encrypted)) as Omit<
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

/** Alias used by notionAuth / slackAuth / bufferAuth / hubspotAuth */
export const getConnection = loadConnection;

/**
 * Load all persisted connections for a user in a single DB round-trip.
 * Used by the batch status endpoint so the Connections UI never waits on
 * N sequential token lookups.
 */
export async function loadAllConnectionsForUser(
  userId: string
): Promise<Map<string, StoredConnection>> {
  const out = new Map<string, StoredConnection>();
  if (!userId?.trim()) return out;

  const admin = supabaseAdmin();
  if (admin) {
    try {
      const { data, error } = await admin
        .from("nexa_oauth_tokens")
        .select("connector_id, ciphertext")
        .eq("user_id", userId);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const connectorId = String((row as { connector_id?: string }).connector_id || "");
          const ciphertext = (row as { ciphertext?: string }).ciphertext;
          if (!connectorId || !ciphertext) continue;
          try {
            const parsed = JSON.parse(decryptSecret(ciphertext)) as Omit<
              StoredConnection,
              "userId" | "connectorId"
            >;
            if (parsed?.accessToken) {
              out.set(connectorId, {
                userId,
                connectorId: connectorId as ConnectorId,
                accessToken: parsed.accessToken,
                refreshToken: parsed.refreshToken,
                workspaceName: parsed.workspaceName,
                workspaceId: parsed.workspaceId,
                botId: parsed.botId,
                scopes: parsed.scopes,
                connectedAt: parsed.connectedAt,
                lastVerifiedAt: parsed.lastVerifiedAt,
              });
              memory.set(memKey(userId, connectorId), ciphertext);
            }
          } catch {
            /* skip corrupt row */
          }
        }
      }
    } catch (e) {
      console.error(
        "[tokenStore] loadAllConnectionsForUser failed",
        e instanceof Error ? e.message : e
      );
    }
  }

  // Merge any in-memory-only entries (dev / fallback)
  for (const [k, ciphertext] of memory.entries()) {
    if (!k.startsWith(`${userId}::`)) continue;
    const connectorId = k.slice(userId.length + 2);
    if (out.has(connectorId)) continue;
    try {
      const parsed = JSON.parse(decryptSecret(ciphertext)) as Omit<
        StoredConnection,
        "userId" | "connectorId"
      >;
      if (parsed?.accessToken) {
        out.set(connectorId, {
          userId,
          connectorId: connectorId as ConnectorId,
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          workspaceName: parsed.workspaceName,
          workspaceId: parsed.workspaceId,
          botId: parsed.botId,
          scopes: parsed.scopes,
          connectedAt: parsed.connectedAt,
          lastVerifiedAt: parsed.lastVerifiedAt,
        });
      }
    } catch {
      /* skip */
    }
  }

  return out;
}

export async function deleteConnection(
  userId: string,
  connectorId: ConnectorId
): Promise<void> {
  memory.delete(memKey(userId, connectorId));
  const admin = supabaseAdmin();
  if (!admin) return;
  await admin
    .from("nexa_oauth_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}

export async function touchVerified(userId: string, connectorId: ConnectorId): Promise<void> {
  const conn = await loadConnection(userId, connectorId);
  if (!conn) return;
  conn.lastVerifiedAt = new Date().toISOString();
  await saveConnection(conn);
}

// ---------------------------------------------------------------------------
// Signed OAuth state (userId + TTL) — used by Slack, Notion, HubSpot
// ---------------------------------------------------------------------------

function stateSigningSecret(): string {
  return (
    process.env.CONNECTOR_TOKEN_SECRET ||
    process.env.HUBSPOT_CLIENT_SECRET ||
    process.env.SLACK_CLIENT_SECRET ||
    process.env.NOTION_CLIENT_SECRET ||
    "nexa-dev-only-change-me"
  );
}

/** Sign a short-lived OAuth state containing the Nexa userId. */
export function signOAuthState(userId: string): string {
  const ts = Date.now().toString(36);
  const uid = Buffer.from(userId, "utf8").toString("base64url");
  const payload = `${uid}.${ts}`;
  const secret = stateSigningSecret();
  const sig = createHash("sha256")
    .update(payload + createHash("sha256").update(secret).digest("hex"))
    .digest("base64url")
    .slice(0, 16);
  return `${payload}.${sig}`;
}

/** Verify signed OAuth state; returns userId or null if invalid/expired (15 min). */
export function verifyOAuthState(state: string | null): string | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length < 3) return null;
  const [uidB64, ts, sig] = parts;
  const payload = `${uidB64}.${ts}`;
  const secret = stateSigningSecret();
  const expected = createHash("sha256")
    .update(payload + createHash("sha256").update(secret).digest("hex"))
    .digest("base64url")
    .slice(0, 16);
  if (sig !== expected) return null;
  const age = Date.now() - parseInt(ts, 36);
  if (Number.isNaN(age) || age > 15 * 60 * 1000) return null;
  try {
    return Buffer.from(uidB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
