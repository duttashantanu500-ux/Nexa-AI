/**
 * Vapi official REST API (per-user private API key).
 * Docs: https://docs.vapi.ai/
 * Auth: Authorization: Bearer <private key>
 * Base: https://api.vapi.ai
 *
 * BYOA only — never use a Nexa-owned Vapi key for customer operations.
 */

const BASE = "https://api.vapi.ai";

export type VapiActionResult = {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: { category: string; providerStatusCode?: number };
};

async function vapiFetch(
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<{ res: Response; json: Record<string, unknown> | unknown[] }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  return { res, json: json as Record<string, unknown> | unknown[] };
}

/** Verify private key by listing assistants (read-only). */
export async function vapiVerifyKey(apiKey: string): Promise<VapiActionResult> {
  try {
    const { res } = await vapiFetch(apiKey, "/assistant");
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message:
          "This Vapi key was not accepted. Use your private API key from the Vapi dashboard.",
        error: { category: "auth", providerStatusCode: res.status },
      };
    }
    if (res.ok) {
      return { ok: true, message: "Your Vapi access is working." };
    }
    if (res.status === 429) {
      return {
        ok: false,
        message: "Vapi is rate-limiting this key. Try again in a moment.",
        error: { category: "rate_limit", providerStatusCode: res.status },
      };
    }
    return {
      ok: false,
      message: "Could not verify Vapi access right now.",
      error: { category: "server_error", providerStatusCode: res.status },
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach Vapi. Check your network and try again.",
      error: { category: "server_error" },
    };
  }
}

export async function vapiListAssistants(apiKey: string): Promise<VapiActionResult> {
  try {
    const { res, json } = await vapiFetch(apiKey, "/assistant");
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message: "Your Vapi access is no longer valid. Reconnect under Connections.",
        error: { category: "auth", providerStatusCode: res.status },
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: "Could not list Vapi assistants.",
        error: { category: "server_error", providerStatusCode: res.status },
      };
    }
    const list = Array.isArray(json) ? json : [];
    const summary = list.slice(0, 25).map((a) => {
      const row = a as Record<string, unknown>;
      return { id: String(row.id || ""), name: String(row.name || "Assistant") };
    });
    return {
      ok: true,
      message: summary.length
        ? `Found ${list.length} assistant(s).`
        : "No assistants in this Vapi account yet.",
      data: { assistants: summary, total: list.length },
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach Vapi.",
      error: { category: "server_error" },
    };
  }
}

export async function vapiListPhoneNumbers(apiKey: string): Promise<VapiActionResult> {
  try {
    const { res, json } = await vapiFetch(apiKey, "/phone-number");
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message: "Your Vapi access is no longer valid. Reconnect under Connections.",
        error: { category: "auth", providerStatusCode: res.status },
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: "Could not list Vapi phone numbers.",
        error: { category: "server_error", providerStatusCode: res.status },
      };
    }
    const list = Array.isArray(json) ? json : [];
    const summary = list.slice(0, 25).map((a) => {
      const row = a as Record<string, unknown>;
      return {
        id: String(row.id || ""),
        number: String(row.number || row.phoneNumber || ""),
        name: String(row.name || ""),
      };
    });
    return {
      ok: true,
      message: summary.length
        ? `Found ${list.length} phone number(s).`
        : "No phone numbers in this Vapi account yet.",
      data: { phoneNumbers: summary, total: list.length },
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach Vapi.",
      error: { category: "server_error" },
    };
  }
}

export async function vapiListCalls(
  apiKey: string,
  limit = 20
): Promise<VapiActionResult> {
  try {
    const lim = Math.min(Math.max(limit || 20, 1), 50);
    const { res, json } = await vapiFetch(apiKey, `/call?limit=${lim}`);
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message: "Your Vapi access is no longer valid. Reconnect under Connections.",
        error: { category: "auth", providerStatusCode: res.status },
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: "Could not list Vapi calls.",
        error: { category: "server_error", providerStatusCode: res.status },
      };
    }
    const list = Array.isArray(json) ? json : [];
    const summary = list.slice(0, lim).map((a) => {
      const row = a as Record<string, unknown>;
      return {
        id: String(row.id || ""),
        status: String(row.status || ""),
        type: String(row.type || ""),
        createdAt: row.createdAt ? String(row.createdAt) : undefined,
      };
    });
    return {
      ok: true,
      message: summary.length ? `Found ${summary.length} call(s).` : "No recent calls.",
      data: { calls: summary },
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach Vapi.",
      error: { category: "server_error" },
    };
  }
}

export async function vapiCreateOutboundCall(params: {
  apiKey: string;
  assistantId: string;
  phoneNumberId: string;
  customerNumber: string;
}): Promise<VapiActionResult> {
  const assistantId = (params.assistantId || "").trim();
  const phoneNumberId = (params.phoneNumberId || "").trim();
  const customerNumber = (params.customerNumber || "").trim();
  if (!assistantId || !phoneNumberId || !customerNumber) {
    return {
      ok: false,
      message: "Assistant ID, phone number ID, and customer number are required.",
      error: { category: "validation" },
    };
  }
  if (!/^\+[1-9]\d{6,14}$/.test(customerNumber)) {
    return {
      ok: false,
      message: "Customer number must be E.164 format (e.g. +15551234567).",
      error: { category: "validation" },
    };
  }

  try {
    const { res, json } = await vapiFetch(params.apiKey, "/call/phone", {
      method: "POST",
      body: JSON.stringify({
        assistantId,
        phoneNumberId,
        customer: { number: customerNumber },
      }),
    });
    const body = (json && !Array.isArray(json) ? json : {}) as Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message: "Your Vapi access is no longer valid. Reconnect under Connections.",
        error: { category: "auth", providerStatusCode: res.status },
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        message: "Vapi rate limit reached. Try again later.",
        error: { category: "rate_limit", providerStatusCode: res.status },
      };
    }
    if (!res.ok) {
      const msg =
        typeof body.message === "string"
          ? body.message
          : "Vapi could not start the call. Check IDs and try again.";
      return {
        ok: false,
        message: msg,
        error: {
          category: res.status >= 500 ? "server_error" : "validation",
          providerStatusCode: res.status,
        },
      };
    }

    return {
      ok: true,
      message: "Outbound call started on your Vapi account.",
      data: {
        callId: body.id ? String(body.id) : undefined,
        status: body.status ? String(body.status) : undefined,
      },
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach Vapi.",
      error: { category: "server_error" },
    };
  }
}
