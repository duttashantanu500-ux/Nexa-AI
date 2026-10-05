/**
 * Client helpers to persist AI employees on the server (Supabase).
 * Always sends the real session Bearer token — never a client-invented user id.
 * If the agents API is not configured, calls fail soft (local state still works).
 */
import { getSupabase } from "./supabase";

async function authHeader(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) return {};
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    /* */
  }
  return {};
}

export async function fetchServerAgents(): Promise<{
  ok: boolean;
  agents: any[];
  serverConfigured: boolean;
  message?: string;
}> {
  const headers = await authHeader();
  if (!headers.Authorization) {
    return { ok: false, agents: [], serverConfigured: false, message: "Not signed in" };
  }
  try {
    const res = await fetch("/api/agents", { headers, cache: "no-store" });
    if (res.status === 404) {
      return { ok: false, agents: [], serverConfigured: false, message: "Server agents API not available." };
    }
    const data = await res.json();
    return {
      ok: Boolean(data.ok),
      agents: Array.isArray(data.agents) ? data.agents : [],
      serverConfigured: Boolean(data.serverConfigured),
      message: data.message,
    };
  } catch {
    return { ok: false, agents: [], serverConfigured: false, message: "Network error" };
  }
}

export async function saveServerAgent(payload: {
  id?: string;
  name: string;
  description?: string;
  purpose?: string;
  status?: string;
  steps: any[];
  schedule?: any;
}): Promise<{ ok: true; id: string; version: number } | { ok: false; message: string }> {
  const headers = await authHeader();
  if (!headers.Authorization) {
    return { ok: false, message: "Please sign in again to save this employee." };
  }
  try {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 404) {
      return { ok: false, message: "Server employee storage is not available yet." };
    }
    const data = await res.json();
    if (!data.ok) return { ok: false, message: data.message || "Could not save employee." };
    return { ok: true, id: data.id, version: data.version };
  } catch {
    return { ok: false, message: "Could not save employee." };
  }
}

export async function patchServerAgent(
  id: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; message?: string }> {
  const headers = await authHeader();
  if (!headers.Authorization) return { ok: false, message: "Please sign in." };
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 404) {
      return { ok: false, message: "Server employee storage is not available yet." };
    }
    const data = await res.json();
    return { ok: Boolean(data.ok), message: data.message };
  } catch {
    return { ok: false, message: "Could not update employee." };
  }
}

export async function deleteServerAgent(id: string): Promise<{ ok: boolean; message?: string }> {
  const headers = await authHeader();
  if (!headers.Authorization) return { ok: false, message: "Please sign in." };
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    });
    if (res.status === 404) {
      return { ok: false, message: "Server employee storage is not available yet." };
    }
    const data = await res.json();
    return { ok: Boolean(data.ok), message: data.message };
  } catch {
    return { ok: false, message: "Could not delete employee." };
  }
}
