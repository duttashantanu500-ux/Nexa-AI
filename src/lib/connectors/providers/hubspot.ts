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

// ─── Contacts ───────────────────────────────────────────────────────────────

export async function hubspotListContacts(params: {
  accessToken?: string;
  limit?: number;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "listContacts");
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const props = "email,firstname,lastname,phone,company,jobtitle,lifecyclestage";
  const { res, data } = await hsFetch(
    `/crm/v3/objects/contacts?limit=${limit}&properties=${props}`,
    params.accessToken
  );
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: { category: res.status === 401 ? "auth" : "server_error", providerStatusCode: res.status },
    };
  }
  const results = (data.results as unknown[]) || [];
  return {
    ok: true,
    message:
      results.length === 0
        ? "No contacts found."
        : `Found ${results.length} contact${results.length === 1 ? "" : "s"}`,
    data: { contacts: results, total: results.length },
  };
}

export async function hubspotSearchContacts(params: {
  accessToken?: string;
  query?: string;
  limit?: number;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "searchContacts");
  const q = (params.query || "").trim();
  if (!q) {
    return { ok: false, message: "Please enter a search term.", error: { category: "validation" } };
  }
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);
  const body = {
    query: q,
    limit,
    properties: ["email", "firstname", "lastname", "phone", "company", "jobtitle"],
  };
  const { res, data } = await hsFetch("/crm/v3/objects/contacts/search", params.accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: { category: res.status === 401 ? "auth" : "server_error", providerStatusCode: res.status },
    };
  }
  const results = (data.results as unknown[]) || [];
  return {
    ok: true,
    message:
      results.length === 0
        ? `No contacts matched "${q}".`
        : `Found ${results.length} contact${results.length === 1 ? "" : "s"} matching "${q}"`,
    data: { contacts: results, total: results.length, query: q },
  };
}

export async function hubspotGetContact(params: {
  accessToken?: string;
  contactId: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "getContact");
  const id = (params.contactId || "").trim();
  if (!id) {
    return { ok: false, message: "Please provide a contact ID.", error: { category: "validation" } };
  }
  const props = "email,firstname,lastname,phone,company,jobtitle,lifecyclestage,createdate,lastmodifieddate";
  const { res, data } = await hsFetch(
    `/crm/v3/objects/contacts/${encodeURIComponent(id)}?properties=${props}`,
    params.accessToken
  );
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: {
        category: res.status === 404 ? "not_found" : res.status === 401 ? "auth" : "server_error",
        providerStatusCode: res.status,
      },
    };
  }
  return {
    ok: true,
    message: "Contact retrieved",
    data: { contact: data },
  };
}

export async function hubspotCreateContact(params: {
  accessToken?: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  jobtitle?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "createContact");
  const email = (params.email || "").trim();
  if (!email) {
    return { ok: false, message: "Email is required to create a contact.", error: { category: "validation" } };
  }
  const properties: Record<string, string> = { email };
  if (params.firstname?.trim()) properties.firstname = params.firstname.trim();
  if (params.lastname?.trim()) properties.lastname = params.lastname.trim();
  if (params.phone?.trim()) properties.phone = params.phone.trim();
  if (params.company?.trim()) properties.company = params.company.trim();
  if (params.jobtitle?.trim()) properties.jobtitle = params.jobtitle.trim();

  const { res, data } = await hsFetch("/crm/v3/objects/contacts", params.accessToken, {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: {
        category: res.status === 401 ? "auth" : res.status === 400 ? "validation" : "server_error",
        providerStatusCode: res.status,
        providerMessage: (data as { message?: string }).message,
      },
    };
  }
  const name = [params.firstname, params.lastname].filter(Boolean).join(" ") || email;
  return {
    ok: true,
    message: `Contact created: ${name}`,
    data: { contact: data, id: data.id },
  };
}

export async function hubspotUpdateContact(params: {
  accessToken?: string;
  contactId: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  jobtitle?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "updateContact");
  const id = (params.contactId || "").trim();
  if (!id) {
    return { ok: false, message: "Please provide a contact ID.", error: { category: "validation" } };
  }
  const properties: Record<string, string> = {};
  if (params.email?.trim()) properties.email = params.email.trim();
  if (params.firstname?.trim()) properties.firstname = params.firstname.trim();
  if (params.lastname?.trim()) properties.lastname = params.lastname.trim();
  if (params.phone?.trim()) properties.phone = params.phone.trim();
  if (params.company?.trim()) properties.company = params.company.trim();
  if (params.jobtitle?.trim()) properties.jobtitle = params.jobtitle.trim();
  if (Object.keys(properties).length === 0) {
    return { ok: false, message: "Provide at least one field to update.", error: { category: "validation" } };
  }

  const { res, data } = await hsFetch(
    `/crm/v3/objects/contacts/${encodeURIComponent(id)}`,
    params.accessToken,
    { method: "PATCH", body: JSON.stringify({ properties }) }
  );
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: {
        category: res.status === 404 ? "not_found" : res.status === 401 ? "auth" : "server_error",
        providerStatusCode: res.status,
      },
    };
  }
  return {
    ok: true,
    message: "Contact updated",
    data: { contact: data },
  };
}

// ─── Companies ──────────────────────────────────────────────────────────────

export async function hubspotListCompanies(params: {
  accessToken?: string;
  limit?: number;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "listCompanies");
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const props = "name,domain,industry,phone,city,state,country,numberofemployees";
  const { res, data } = await hsFetch(
    `/crm/v3/objects/companies?limit=${limit}&properties=${props}`,
    params.accessToken
  );
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: { category: res.status === 401 ? "auth" : "server_error", providerStatusCode: res.status },
    };
  }
  const results = (data.results as unknown[]) || [];
  return {
    ok: true,
    message:
      results.length === 0
        ? "No companies found."
        : `Found ${results.length} compan${results.length === 1 ? "y" : "ies"}`,
    data: { companies: results, total: results.length },
  };
}

export async function hubspotSearchCompanies(params: {
  accessToken?: string;
  query?: string;
  limit?: number;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "searchCompanies");
  const q = (params.query || "").trim();
  if (!q) {
    return { ok: false, message: "Please enter a search term.", error: { category: "validation" } };
  }
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);
  const body = {
    query: q,
    limit,
    properties: ["name", "domain", "industry", "phone", "city", "state"],
  };
  const { res, data } = await hsFetch("/crm/v3/objects/companies/search", params.accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: { category: res.status === 401 ? "auth" : "server_error", providerStatusCode: res.status },
    };
  }
  const results = (data.results as unknown[]) || [];
  return {
    ok: true,
    message:
      results.length === 0
        ? `No companies matched "${q}".`
        : `Found ${results.length} compan${results.length === 1 ? "y" : "ies"} matching "${q}"`,
    data: { companies: results, total: results.length, query: q },
  };
}

export async function hubspotGetCompany(params: {
  accessToken?: string;
  companyId: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "getCompany");
  const id = (params.companyId || "").trim();
  if (!id) {
    return { ok: false, message: "Please provide a company ID.", error: { category: "validation" } };
  }
  const props = "name,domain,industry,phone,city,state,country,numberofemployees,createdate";
  const { res, data } = await hsFetch(
    `/crm/v3/objects/companies/${encodeURIComponent(id)}?properties=${props}`,
    params.accessToken
  );
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: {
        category: res.status === 404 ? "not_found" : res.status === 401 ? "auth" : "server_error",
        providerStatusCode: res.status,
      },
    };
  }
  return {
    ok: true,
    message: "Company retrieved",
    data: { company: data },
  };
}

export async function hubspotCreateCompany(params: {
  accessToken?: string;
  name?: string;
  domain?: string;
  industry?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "createCompany");
  const name = (params.name || "").trim();
  if (!name) {
    return { ok: false, message: "Company name is required.", error: { category: "validation" } };
  }
  const properties: Record<string, string> = { name };
  if (params.domain?.trim()) properties.domain = params.domain.trim();
  if (params.industry?.trim()) properties.industry = params.industry.trim();
  if (params.phone?.trim()) properties.phone = params.phone.trim();
  if (params.city?.trim()) properties.city = params.city.trim();
  if (params.state?.trim()) properties.state = params.state.trim();
  if (params.country?.trim()) properties.country = params.country.trim();

  const { res, data } = await hsFetch("/crm/v3/objects/companies", params.accessToken, {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: {
        category: res.status === 401 ? "auth" : res.status === 400 ? "validation" : "server_error",
        providerStatusCode: res.status,
      },
    };
  }
  return {
    ok: true,
    message: `Company created: ${name}`,
    data: { company: data, id: data.id },
  };
}

export async function hubspotUpdateCompany(params: {
  accessToken?: string;
  companyId: string;
  name?: string;
  domain?: string;
  industry?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "updateCompany");
  const id = (params.companyId || "").trim();
  if (!id) {
    return { ok: false, message: "Please provide a company ID.", error: { category: "validation" } };
  }
  const properties: Record<string, string> = {};
  if (params.name?.trim()) properties.name = params.name.trim();
  if (params.domain?.trim()) properties.domain = params.domain.trim();
  if (params.industry?.trim()) properties.industry = params.industry.trim();
  if (params.phone?.trim()) properties.phone = params.phone.trim();
  if (params.city?.trim()) properties.city = params.city.trim();
  if (params.state?.trim()) properties.state = params.state.trim();
  if (params.country?.trim()) properties.country = params.country.trim();
  if (Object.keys(properties).length === 0) {
    return { ok: false, message: "Provide at least one field to update.", error: { category: "validation" } };
  }

  const { res, data } = await hsFetch(
    `/crm/v3/objects/companies/${encodeURIComponent(id)}`,
    params.accessToken,
    { method: "PATCH", body: JSON.stringify({ properties }) }
  );
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: {
        category: res.status === 404 ? "not_found" : res.status === 401 ? "auth" : "server_error",
        providerStatusCode: res.status,
      },
    };
  }
  return {
    ok: true,
    message: "Company updated",
    data: { company: data },
  };
}

// ─── Deals ──────────────────────────────────────────────────────────────────

export async function hubspotListDeals(params: {
  accessToken?: string;
  limit?: number;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "listDeals");
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const props = "dealname,amount,dealstage,pipeline,closedate,createdate,hs_lastmodifieddate";
  const { res, data } = await hsFetch(
    `/crm/v3/objects/deals?limit=${limit}&properties=${props}`,
    params.accessToken
  );
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: { category: res.status === 401 ? "auth" : "server_error", providerStatusCode: res.status },
    };
  }
  const results = (data.results as unknown[]) || [];
  return {
    ok: true,
    message:
      results.length === 0
        ? "No deals found."
        : `Found ${results.length} deal${results.length === 1 ? "" : "s"}`,
    data: { deals: results, total: results.length },
  };
}

export async function hubspotSearchDeals(params: {
  accessToken?: string;
  query?: string;
  limit?: number;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "searchDeals");
  const q = (params.query || "").trim();
  if (!q) {
    return { ok: false, message: "Please enter a search term.", error: { category: "validation" } };
  }
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);
  const body = {
    query: q,
    limit,
    properties: ["dealname", "amount", "dealstage", "pipeline", "closedate"],
  };
  const { res, data } = await hsFetch("/crm/v3/objects/deals/search", params.accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: { category: res.status === 401 ? "auth" : "server_error", providerStatusCode: res.status },
    };
  }
  const results = (data.results as unknown[]) || [];
  return {
    ok: true,
    message:
      results.length === 0
        ? `No deals matched "${q}".`
        : `Found ${results.length} deal${results.length === 1 ? "" : "s"} matching "${q}"`,
    data: { deals: results, total: results.length, query: q },
  };
}

export async function hubspotGetDeal(params: {
  accessToken?: string;
  dealId: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "getDeal");
  const id = (params.dealId || "").trim();
  if (!id) {
    return { ok: false, message: "Please provide a deal ID.", error: { category: "validation" } };
  }
  const props = "dealname,amount,dealstage,pipeline,closedate,createdate,hs_lastmodifieddate";
  const { res, data } = await hsFetch(
    `/crm/v3/objects/deals/${encodeURIComponent(id)}?properties=${props}`,
    params.accessToken
  );
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: {
        category: res.status === 404 ? "not_found" : res.status === 401 ? "auth" : "server_error",
        providerStatusCode: res.status,
      },
    };
  }
  return {
    ok: true,
    message: "Deal retrieved",
    data: { deal: data },
  };
}

export async function hubspotCreateDeal(params: {
  accessToken?: string;
  dealname?: string;
  amount?: string;
  dealstage?: string;
  pipeline?: string;
  closedate?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "createDeal");
  const dealname = (params.dealname || "").trim();
  if (!dealname) {
    return { ok: false, message: "Deal name is required.", error: { category: "validation" } };
  }
  const properties: Record<string, string> = { dealname };
  if (params.amount?.trim()) properties.amount = params.amount.trim();
  if (params.dealstage?.trim()) properties.dealstage = params.dealstage.trim();
  if (params.pipeline?.trim()) properties.pipeline = params.pipeline.trim();
  if (params.closedate?.trim()) properties.closedate = params.closedate.trim();

  const { res, data } = await hsFetch("/crm/v3/objects/deals", params.accessToken, {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: {
        category: res.status === 401 ? "auth" : res.status === 400 ? "validation" : "server_error",
        providerStatusCode: res.status,
      },
    };
  }
  return {
    ok: true,
    message: `Deal created: ${dealname}`,
    data: { deal: data, id: data.id },
  };
}

export async function hubspotUpdateDeal(params: {
  accessToken?: string;
  dealId: string;
  dealname?: string;
  amount?: string;
  dealstage?: string;
  pipeline?: string;
  closedate?: string;
}): Promise<ProviderResult> {
  if (!params.accessToken) return notConfigured("HubSpot", "updateDeal");
  const id = (params.dealId || "").trim();
  if (!id) {
    return { ok: false, message: "Please provide a deal ID.", error: { category: "validation" } };
  }
  const properties: Record<string, string> = {};
  if (params.dealname?.trim()) properties.dealname = params.dealname.trim();
  if (params.amount?.trim()) properties.amount = params.amount.trim();
  if (params.dealstage?.trim()) properties.dealstage = params.dealstage.trim();
  if (params.pipeline?.trim()) properties.pipeline = params.pipeline.trim();
  if (params.closedate?.trim()) properties.closedate = params.closedate.trim();
  if (Object.keys(properties).length === 0) {
    return { ok: false, message: "Provide at least one field to update.", error: { category: "validation" } };
  }

  const { res, data } = await hsFetch(
    `/crm/v3/objects/deals/${encodeURIComponent(id)}`,
    params.accessToken,
    { method: "PATCH", body: JSON.stringify({ properties }) }
  );
  if (!res.ok) {
    return {
      ok: false,
      message: friendlyHubspotError(res.status, data as { message?: string }),
      error: {
        category: res.status === 404 ? "not_found" : res.status === 401 ? "auth" : "server_error",
        providerStatusCode: res.status,
      },
    };
  }
  return {
    ok: true,
    message: "Deal updated",
    data: { deal: data },
  };
}
