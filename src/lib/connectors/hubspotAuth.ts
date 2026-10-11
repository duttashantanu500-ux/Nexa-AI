/**
 * HubSpot OAuth helpers — tokens stay server-side (tokenStore).
 * PKCE is required by HubSpot for this app's authorization requests.
 */

import { createHash, randomBytes } from "crypto";
import {
  getConnection,
  saveConnection,
  type StoredConnection,
} from "./tokenStore";

const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";

export const HUBSPOT_SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
].join(" ");

export function hubspotOAuthConfigured(): boolean {
  return Boolean(
    process.env.HUBSPOT_CLIENT_ID?.trim() &&
      process.env.HUBSPOT_CLIENT_SECRET?.trim()
  );
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function stateSigningSecret(): string {
  return (
    process.env.CONNECTOR_TOKEN_SECRET ||
    process.env.HUBSPOT_CLIENT_SECRET ||
    process.env.HUBSPOT_CLIENT_ID ||
    "nexa-dev-only-change-me"
  );
}

/** State embeds userId + PKCE verifier (signed). */
export function signHubspotOAuthState(userId: string, codeVerifier: string): string {
  const ts = Date.now().toString(36);
  const uid = Buffer.from(userId, "utf8").toString("base64url");
  const ver = Buffer.from(codeVerifier, "utf8").toString("base64url");
  const payload = `${uid}.${ts}.${ver}`;
  const secret = stateSigningSecret();
  const sig = createHash("sha256")
    .update(payload + createHash("sha256").update(secret).digest("hex"))
    .digest("base64url")
    .slice(0, 16);
  return `${payload}.${sig}`;
}

export function verifyHubspotOAuthState(
  state: string | null
): { userId: string; codeVerifier: string } | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length < 4) return null;
  const [uidB64, ts, verB64, sig] = parts;
  const payload = `${uidB64}.${ts}.${verB64}`;
  const secret = stateSigningSecret();
  const expected = createHash("sha256")
    .update(payload + createHash("sha256").update(secret).digest("hex"))
    .digest("base64url")
    .slice(0, 16);
  if (sig !== expected) return null;
  const age = Date.now() - parseInt(ts, 36);
  if (Number.isNaN(age) || age > 15 * 60 * 1000) return null;
  try {
    return {
      userId: Buffer.from(uidB64, "base64url").toString("utf8"),
      codeVerifier: Buffer.from(verB64, "base64url").toString("utf8"),
    };
  } catch {
    return null;
  }
}

async function refreshAccessToken(
  conn: StoredConnection
): Promise<StoredConnection | null> {
  if (!conn.refreshToken) return null;
  const clientId = process.env.HUBSPOT_CLIENT_ID?.trim();
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refreshToken,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !data.access_token) return null;

    const updated: StoredConnection = {
      ...conn,
      accessToken: String(data.access_token),
      refreshToken: data.refresh_token
        ? String(data.refresh_token)
        : conn.refreshToken,
      lastVerifiedAt: new Date().toISOString(),
    };
    await saveConnection(updated);
    return updated;
  } catch {
    return null;
  }
}

/** Resolve a valid HubSpot access token for this Nexa user (refreshes when needed). */
export async function resolveHubspotToken(
  userId: string
): Promise<{ token: string; meta: StoredConnection } | null> {
  if (!userId?.trim()) return null;
  let conn = await getConnection(userId, "hubspot");
  if (!conn?.accessToken) return null;

  const probe = await fetch(
    "https://api.hubapi.com/oauth/v1/access-tokens/" +
      encodeURIComponent(conn.accessToken),
    { method: "GET" }
  );
  if (probe.status === 401 || probe.status === 404) {
    const refreshed = await refreshAccessToken(conn);
    if (!refreshed?.accessToken) return null;
    conn = refreshed;
  }

  return { token: conn.accessToken, meta: conn };
}
