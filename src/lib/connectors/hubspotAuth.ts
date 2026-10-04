/**
 * HubSpot OAuth helpers — tokens stay server-side (tokenStore).
 */

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
