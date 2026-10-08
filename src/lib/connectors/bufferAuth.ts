import { createHash, randomBytes } from "crypto";
import {
  getConnection,
  saveConnection,
  deleteConnection,
  type StoredConnection,
} from "./tokenStore";

const TOKEN_URL = "https://auth.buffer.com/token";

/** Public clients only need client_id; confidential clients may also set client_secret. */
export function bufferOAuthConfigured(): boolean {
  return Boolean(process.env.BUFFER_CLIENT_ID?.trim());
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function stateSigningSecret(): string {
  return (
    process.env.CONNECTOR_TOKEN_SECRET ||
    process.env.BUFFER_CLIENT_SECRET ||
    process.env.BUFFER_CLIENT_ID ||
    "nexa-dev-only-change-me"
  );
}

/** State embeds userId + PKCE verifier (signed). */
export function signBufferOAuthState(userId: string, codeVerifier: string): string {
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

export function verifyBufferOAuthState(
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
  const clientId = process.env.BUFFER_CLIENT_ID?.trim();
  if (!clientId) return null;

  const body: Record<string, string> = {
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: conn.refreshToken,
  };
  // Confidential clients only — public clients must omit client_secret
  const clientSecret = process.env.BUFFER_CLIENT_SECRET?.trim();
  if (clientSecret) {
    body.client_secret = clientSecret;
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) return null;

    const updated: StoredConnection = {
      ...conn,
      accessToken: data.access_token as string,
      // Refresh tokens are single-use — always store the new one
      refreshToken: (data.refresh_token as string) || conn.refreshToken,
      lastVerifiedAt: new Date().toISOString(),
    };
    await saveConnection(updated);
    return updated;
  } catch {
    return null;
  }
}

/**
 * Resolve a usable Buffer access token for this user.
 * On hard auth failure (probe 401 + refresh fail, or missing token), clears the
 * stored connection so batch status stops showing "Connected" for a dead token.
 */
export async function resolveBufferToken(
  userId: string
): Promise<{ token: string; meta: StoredConnection } | null> {
  if (!userId?.trim()) return null;
  let conn = await getConnection(userId, "buffer");
  if (!conn?.accessToken) return null;

  // Lightweight probe; on auth failure try refresh once
  let probeStatus = 0;
  try {
    const probe = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "{ account { id } }" }),
    });
    probeStatus = probe.status;
  } catch {
    // Network blip — do not wipe token; let the caller retry later
    return { token: conn.accessToken, meta: conn };
  }

  if (probeStatus === 401) {
    const refreshed = await refreshAccessToken(conn);
    if (refreshed?.accessToken) {
      return { token: refreshed.accessToken, meta: refreshed };
    }
    // Dead token — remove so Connections UI / usage counts stay truthful
    try {
      await deleteConnection(userId, "buffer");
    } catch {
      /* ignore */
    }
    return null;
  }

  // Non-401 failures (rate limit, 5xx): keep token, return it for best-effort use
  return { token: conn.accessToken, meta: conn };
}
