import { getConnection, type StoredConnection } from "./tokenStore";

export async function resolveSlackToken(
  userId: string
): Promise<{ token: string; meta: StoredConnection } | null> {
  if (!userId?.trim()) return null;
  const conn = await getConnection(userId, "slack");
  if (conn?.accessToken) {
    return { token: conn.accessToken, meta: conn };
  }
  return null;
}

export function slackOAuthConfigured(): boolean {
  return Boolean(
    process.env.SLACK_CLIENT_ID?.trim() && process.env.SLACK_CLIENT_SECRET?.trim()
  );
}
