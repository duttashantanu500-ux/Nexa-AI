/**
 * Server-side connector action execution for cron / background runs.
 * Uses the same provider modules and per-user tokens as the HTTP execute routes.
 * Never fabricates success. Never uses another user's credentials.
 */

import type { NormalizedProviderError } from "@/types";

export type ServerActionResult = {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: NormalizedProviderError;
};

function mapError(err?: { category?: string; providerStatusCode?: number; providerMessage?: string }): NormalizedProviderError | undefined {
  if (!err) return undefined;
  const allowed = new Set([
    "auth",
    "rate_limit",
    "validation",
    "server_error",
    "unknown",
    "mapping_error",
    "not_configured",
  ]);
  const category = allowed.has(String(err.category || ""))
    ? (err.category as NormalizedProviderError["category"])
    : "unknown";
  return {
    category,
    providerStatusCode: err.providerStatusCode,
    providerMessage: err.providerMessage,
  };
}

function notConnected(name: string): ServerActionResult {
  return {
    ok: false,
    message: `Connect your own ${name} account under Connections first.`,
    error: { category: "auth" },
  };
}

function unknownAction(actionId: string): ServerActionResult {
  return {
    ok: false,
    message: `This action is not available: ${actionId}`,
    error: { category: "validation" },
  };
}

function fromProvider(r: {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: { category?: string; providerStatusCode?: number; providerMessage?: string };
}): ServerActionResult {
  return {
    ok: r.ok,
    message: r.message,
    data: r.data,
    error: mapError(r.error),
  };
}

/**
 * Execute a registry actionId for a specific user using stored credentials.
 */
export async function executeServerAction(params: {
  userId: string;
  actionId: string;
  input?: Record<string, string>;
  notionDefaultParent?: string;
}): Promise<ServerActionResult> {
  const userId = (params.userId || "").trim();
  const actionId = (params.actionId || "").trim();
  const input = params.input || {};

  if (!userId) {
    return {
      ok: false,
      message: "Sign in required to run this action.",
      error: { category: "auth" },
    };
  }
  if (!actionId) {
    return unknownAction("");
  }

  const provider = actionId.split(".")[0];

  try {
    switch (provider) {
      case "notion":
        return await runNotion(userId, actionId, input, params.notionDefaultParent);
      case "slack":
        return await runSlack(userId, actionId, input);
      case "buffer":
        return await runBuffer(userId, actionId, input);
      case "hubspot":
        return await runHubspot(userId, actionId, input);
      case "ideogram":
        return await runIdeogram(userId, actionId, input);
      case "vapi":
        return await runVapi(userId, actionId, input);
      case "mcp":
        return await runMcp(userId, actionId, input);
      default:
        return {
          ok: false,
          message: `Server execution for ${provider} is not configured.`,
          error: { category: "not_configured" },
        };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Provider call failed",
      error: { category: "server_error" },
    };
  }
}

async function runNotion(
  userId: string,
  actionId: string,
  input: Record<string, string>,
  defaultParent?: string
): Promise<ServerActionResult> {
  const { resolveNotionToken } = await import("./notionAuth");
  const { notionSearch, notionCreatePage, notionAppendBlocks } = await import(
    "./providers/notion"
  );
  const { extractNotionPageId, formatNotionPageId } = await import("./notionParent");

  const resolved = await resolveNotionToken(userId);
  if (!resolved?.token) return notConnected("Notion");

  if (actionId === "notion.search") {
    const r = await notionSearch({
      accessToken: resolved.token,
      query: input.query || input.title || "",
    });
    return fromProvider(r);
  }

  if (actionId === "notion.create_page") {
    let parentId =
      extractNotionPageId(input.parent_id || "") ||
      extractNotionPageId(input.parent_url || "") ||
      extractNotionPageId(defaultParent || "");
    if (!parentId && (input.parent_name || input.parent || "").trim()) {
      const search = await notionSearch({
        accessToken: resolved.token,
        query: (input.parent_name || input.parent || "").trim(),
      });
      const pages = (search.data as { pages?: { id: string }[] })?.pages || [];
      if (pages[0]?.id) parentId = pages[0].id;
    }
    if (!parentId) {
      return {
        ok: false,
        message:
          "Set a default page in Connections → Notion, or name a parent page for this step.",
        error: { category: "validation" },
      };
    }
    const r = await notionCreatePage({
      accessToken: resolved.token,
      parentId: formatNotionPageId(parentId),
      title: input.title || "Untitled",
      content: input.content,
    });
    return fromProvider(r);
  }

  if (actionId === "notion.append_blocks") {
    let pageId =
      extractNotionPageId(input.page_id || "") || extractNotionPageId(input.page_url || "");
    if (!pageId && (input.page_name || input.page || "").trim()) {
      const search = await notionSearch({
        accessToken: resolved.token,
        query: (input.page_name || input.page || "").trim(),
      });
      const pages = (search.data as { pages?: { id: string }[] })?.pages || [];
      if (pages[0]?.id) pageId = pages[0].id;
    }
    const r = await notionAppendBlocks({
      accessToken: resolved.token,
      pageId: pageId ? formatNotionPageId(pageId) : "",
      content: input.content || "",
    });
    return fromProvider(r);
  }

  return unknownAction(actionId);
}

async function runSlack(
  userId: string,
  actionId: string,
  input: Record<string, string>
): Promise<ServerActionResult> {
  const { loadConnection } = await import("./tokenStore");
  const conn = await loadConnection(userId, "slack");
  if (!conn?.accessToken) return notConnected("Slack");

  const { slackListChannels, slackPostMessage } = await import("./providers/slack");

  if (actionId === "slack.list_channels") {
    const r = await slackListChannels({ accessToken: conn.accessToken });
    return fromProvider(r);
  }
  if (actionId === "slack.post_message") {
    const r = await slackPostMessage({
      accessToken: conn.accessToken,
      channel: input.channel || "",
      text: input.text || "",
    });
    return fromProvider(r);
  }
  return unknownAction(actionId);
}

async function runBuffer(
  userId: string,
  actionId: string,
  input: Record<string, string>
): Promise<ServerActionResult> {
  const { resolveBufferToken } = await import("./bufferAuth");
  const resolved = await resolveBufferToken(userId);
  if (!resolved?.token) return notConnected("Buffer");

  const { bufferListChannels, bufferListPosts, bufferCreatePost } = await import(
    "./providers/buffer"
  );

  if (actionId === "buffer.list_channels") {
    const r = await bufferListChannels({ accessToken: resolved.token });
    return fromProvider(r);
  }
  if (actionId === "buffer.list_posts") {
    const r = await bufferListPosts({
      accessToken: resolved.token,
      channel: input.channel || "",
    });
    return fromProvider(r);
  }
  if (actionId === "buffer.create_post") {
    const r = await bufferCreatePost({
      accessToken: resolved.token,
      channel: input.channel || "",
      text: input.text || "",
      scheduledAt: input.scheduled_at || input.scheduledAt || "",
    });
    return fromProvider(r);
  }
  return unknownAction(actionId);
}

async function runHubspot(
  userId: string,
  actionId: string,
  input: Record<string, string>
): Promise<ServerActionResult> {
  const { resolveHubspotToken } = await import("./hubspotAuth");
  const resolved = await resolveHubspotToken(userId);
  if (!resolved?.token) return notConnected("HubSpot");

  const hs = await import("./providers/hubspot");
  const token = resolved.token;
  const limit = parseInt(String(input.limit || "20"), 10);
  const lim = Number.isFinite(limit) ? limit : 20;

  switch (actionId) {
    case "hubspot.list_contacts":
      return fromProvider(await hs.hubspotListContacts({ accessToken: token, limit: lim }));
    case "hubspot.search_contacts":
      return fromProvider(
        await hs.hubspotSearchContacts({ accessToken: token, query: input.query || "" })
      );
    case "hubspot.get_contact":
      return fromProvider(
        await hs.hubspotGetContact({
          accessToken: token,
          contactId: input.contactId || input.id || "",
        })
      );
    case "hubspot.create_contact":
      return fromProvider(
        await hs.hubspotCreateContact({
          accessToken: token,
          email: input.email || "",
          firstname: input.firstname,
          lastname: input.lastname,
          phone: input.phone,
          company: input.company,
        })
      );
    case "hubspot.update_contact":
      return fromProvider(
        await hs.hubspotUpdateContact({
          accessToken: token,
          contactId: input.contactId || input.id || "",
          email: input.email,
          firstname: input.firstname,
          lastname: input.lastname,
          phone: input.phone,
          company: input.company,
        })
      );
    case "hubspot.list_companies":
      return fromProvider(await hs.hubspotListCompanies({ accessToken: token, limit: lim }));
    case "hubspot.search_companies":
      return fromProvider(
        await hs.hubspotSearchCompanies({ accessToken: token, query: input.query || "" })
      );
    case "hubspot.create_company":
      return fromProvider(
        await hs.hubspotCreateCompany({
          accessToken: token,
          name: input.name || "",
          domain: input.domain,
        })
      );
    case "hubspot.list_deals":
      return fromProvider(await hs.hubspotListDeals({ accessToken: token, limit: lim }));
    case "hubspot.search_deals":
      return fromProvider(
        await hs.hubspotSearchDeals({ accessToken: token, query: input.query || "" })
      );
    case "hubspot.create_deal":
      return fromProvider(
        await hs.hubspotCreateDeal({
          accessToken: token,
          dealname: input.dealname || input.name || "",
          amount: input.amount,
          dealstage: input.dealstage,
        })
      );
    case "hubspot.update_deal":
      return fromProvider(
        await hs.hubspotUpdateDeal({
          accessToken: token,
          dealId: input.dealId || input.id || "",
          dealname: input.dealname,
          amount: input.amount,
          dealstage: input.dealstage,
        })
      );
    default:
      return unknownAction(actionId);
  }
}

async function runIdeogram(
  userId: string,
  actionId: string,
  input: Record<string, string>
): Promise<ServerActionResult> {
  const { resolveIdeogramToken } = await import("./ideogramAuth");
  const resolved = await resolveIdeogramToken(userId);
  if (!resolved?.token) return notConnected("Ideogram");

  if (actionId === "ideogram.generate_image") {
    const { ideogramGenerateImage } = await import("./providers/ideogram");
    const r = await ideogramGenerateImage({
      apiKey: resolved.token,
      prompt: input.prompt || "",
    });
    return fromProvider(r);
  }
  return unknownAction(actionId);
}

async function runVapi(
  userId: string,
  actionId: string,
  input: Record<string, string>
): Promise<ServerActionResult> {
  const { resolveVapiToken } = await import("./vapiAuth");
  const resolved = await resolveVapiToken(userId);
  if (!resolved?.token) return notConnected("Vapi");

  const vapi = await import("./providers/vapi");

  if (actionId === "vapi.list_assistants") {
    return fromProvider(await vapi.vapiListAssistants(resolved.token));
  }
  if (actionId === "vapi.list_phone_numbers") {
    return fromProvider(await vapi.vapiListPhoneNumbers(resolved.token));
  }
  if (actionId === "vapi.list_calls") {
    const limit = parseInt(String(input.limit || "20"), 10);
    return fromProvider(
      await vapi.vapiListCalls(resolved.token, Number.isFinite(limit) ? limit : 20)
    );
  }
  if (actionId === "vapi.create_outbound_call") {
    return fromProvider(
      await vapi.vapiCreateOutboundCall({
        apiKey: resolved.token,
        assistantId: input.assistantId || "",
        phoneNumberId: input.phoneNumberId || "",
        customerNumber: input.customerNumber || "",
      })
    );
  }
  return unknownAction(actionId);
}

async function runMcp(
  userId: string,
  actionId: string,
  input: Record<string, string>
): Promise<ServerActionResult> {
  if (actionId !== "mcp.call_tool") return unknownAction(actionId);
  const toolName = (input.tool || input.toolName || "").trim();
  let args: Record<string, unknown> = {};
  try {
    if (input.args) args = JSON.parse(input.args);
  } catch {
    /* */
  }
  try {
    const { executeApprovedMcpTool } = await import("./mcpAuth");
    const r = await executeApprovedMcpTool({ userId, toolName, args });
    return {
      ok: r.ok,
      message: r.message,
      data: r.data,
      error: r.ok ? undefined : { category: "unknown" },
    };
  } catch {
    return {
      ok: false,
      message: "Could not run this MCP tool.",
      error: { category: "server_error" },
    };
  }
}
