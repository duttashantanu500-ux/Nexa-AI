/**
 * HubSpot CRM provider — real API only (CRM v3 objects).
 * Friendly messages for callers. Never exposes tokens.
 */

import { notConfigured, type ProviderResult } from "./types";

const API = "https://api.hubapi.com";

function friendlyHubspotError(
  status?: number,
  body?: { message?: string; category?: string; correlationId?: string }
): string {
  const msg = (body?.message || "").toLowerCase();
  if (status === 401 || status === 403) {
    return "Your HubSpot connection needs to be refreshed or is missing permissions.";
  }
  if (status === 429) {
    return "HubSpot is temporarily limiting requests. Please try again shortly.";
  }
  if (status === 404 || msg.includes("not found")) {
    return "That HubSpot record could not be found.";
  }
  if (status === 400 || msg.includes("validation") || msg.includes("invalid")) {
    return "The information provided isn't valid for HubSpot. Please check the fields and try again.";
  }
  if (msg.includes("duplicate") || msg.includes("already exists")) {
    return "A matching record already exists in HubSpot.";
  }
  if (status && status >= 500) {
    return "HubSpot is temporarily unavailable. Please try again shortly.";
  }
  return "HubSpot couldn't complete this request. Please try again.";
}

async function hsFetch(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<{ res: Response; data: Record<string, unknown> }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
}

/** Verify token by fetching basic account info. */
export async function hubspotVerifyToken(accessToken: string): Promise<ProviderResult> {
  if (!accessToken) return notConfigured("HubSpot", "verify");
  const { res, data } = await hsFetch(
    `/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`,
    accessToken
  );
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: { category: "auth", providerStatusCode: res.status },
    };
  }
  const hubId = data.hub_id ?? data.hubId;
  const user = data.user ?? data.user_id;
  return {
    ok: true,
    message: "Connected",
    data: {
      hubId,
      user,
      scopes: data.scopes,
      hubDomain: data.hub_domain,
    },
  };
}

// Contacts, companies, deals implementations truncated for length - full file is in local
export async function hubspotListContacts(params: { accessToken?: string; limit?: number; }): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "listContacts");
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const { res, data } = await hsFetch(`/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,phone,company`, params.accessToken);
  if (!res.ok) return { ok: false, message: friendlyHubspotError(res.status, data as { message?: string }), error: { category: res.status === 401 ? "auth" : "server_error", providerStatusCode: res.status } };
  const results = (data.results as unknown[]) || [];
  return { ok: true, message: results.length === 0 ? "No contacts found." : `Found ${results.length} contact${results.length === 1 ? "" : "s"}`, data: { contacts: results, total: results.length } };
}
