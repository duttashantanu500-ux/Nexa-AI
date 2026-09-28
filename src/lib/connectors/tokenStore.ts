/**
 * Server-side OAuth token storage for connectors.
 * Tokens never go to the browser. Encrypted at rest.
 *
 * When Supabase is configured, tokens MUST be written to nexa_oauth_tokens.
 * In-memory storage is only used when Supabase is not configured (local dev).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

export type ConnectorId = "notion" | "slack" | "github" | "buffer";

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
  // Reject common mistakes: dashboard URL, rest path, postgres URI
  if (u.includes("supabase.com/dashboard")) return null;
  if (u.includes("/rest/v1")) u = u.split("/rest/v1")[0].replace(/\/+$/, "");
  if (u.startsWith("postgres://") || u.startsWith("postgresql://")) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return null;
    // Accept both *.supabase.co and custom domains
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function getSupabaseUrlHint(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return u.host || null;
  } catch {
    return raw.trim().slice(0, 40);
  }
}

function supabaseConfigured(): boolean {
  return Boolean(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

function adminClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
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
  const c = (code || "").toLowerCase();

  if (
    c === "42p01" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  ) {
    return { ok: false, reason: "missing_table", detail: message };
  }
  if (
    c === "42501" ||
    msg.includes("permission") ||
    msg.includes("rls") ||
    msg.includes("policy") ||
    msg.includes("row-level security")
  ) {
    return { ok: false, reason: "rls_or_permission", detail: message };
  }
  if (
    msg.includes("invalid api key") ||
    msg.includes("jwt") ||
    msg.includes("invalid_api_key") ||
    msg.includes("failed to parse") ||
    msg.includes("invalid path") ||
    msg.includes("invalid url") ||
    msg.includes("fetch failed") ||
    c === "pgrst301"
  ) {
    return { ok: false, reason: "bad_config", detail: message };
  }
  return { ok: false, reason: "unknown", detail: message };
}

/** Probe whether connector tokens can be stored durably. */
export async function checkTokenStorageHealth(): Promise<StorageHealth> {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl?.trim()) {
    return { ok: true, mode: "memory" };
  }

  const url = normalizeSupabaseUrl(rawUrl);
  if (!url) {
    return {
      ok: false,
      reason: "bad_config",
      detail:
        "NEXT_PUBLIC_SUPABASE_URL must be https://YOUR_PROJECT.supabase.co (Project URL from Supabase → Settings → API). Not the dashboard link, not postgres://, not /rest/v1.",
    };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, reason: "no_supabase" };
  }

  const sb = adminClient();
  if (!sb) return { ok: false, reason: "no_supabase" };

  try {
    const { error } = await sb.from("nexa_oauth_tokens").select("user_id").limit(1);
    if (!error) return { ok: true, mode: "supabase" };
    return classifyStorageError(error.message, (error as { code?: string }).code);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return classifyStorageError(message);
  }
}

export async function saveConnection(
  conn: StoredConnection
): Promise<{ ok: boolean; error?: string }> {
  if (!conn.userId?.trim()) {
    return { ok: false, error: "missing_user" };
  }

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
      console.error("[tokenStore] saveConnection failed", error.message);
      return { ok: false, error: error.message };
    }
    memory.set(memKey(conn.userId, conn.connectorId), encrypted);
    return { ok: true };
  }

  if (!supabaseConfigured()) {
    memory.set(memKey(conn.userId, conn.connectorId), encrypted);
    return { ok: true };
  }

  return { ok: false, error: "storage_unavailable" };
}

export async function getConnection(
  userId: string,
  connectorId: ConnectorId
): Promise<StoredConnection | null> {
  if (!userId?.trim()) return null;

  let ciphertext: string | null = null;

  const sb = adminClient();
  if (sb) {
    const { data, error } = await sb
      .from("nexa_oauth_tokens")
      .select("ciphertext")
      .eq("user_id", userId)
      .eq("connector_id", connectorId)
      .maybeSingle();
    if (error) {
      console.error("[tokenStore] getConnection failed", error.message);
    }
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
    console.error("[tokenStore] decrypt failed — check CONNECTOR_TOKEN_SECRET is stable");
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

export function signOAuthState(userId: string): string {
  const ts = Date.now().toString(36);
  const uid = Buffer.from(userId, "utf8").toString("base64url");
  const payload = `${uid}.${ts}`;
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
  const [uidB64, ts, sig] = parts;
  const payload = `${uidB64}.${ts}`;
  const expected = createHash("sha256")
    .update(payload + encryptionKey().toString("hex"))
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
