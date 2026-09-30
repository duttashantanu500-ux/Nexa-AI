import { getSupabase } from "./supabase";

/** Authorization headers for authenticated API calls (browser only). */
export async function authHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...(extra || {}) };
  try {
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* ignore */
  }
  return headers;
}
