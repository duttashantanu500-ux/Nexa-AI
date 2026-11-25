/**
 * Server-side action execution for background / employee runs.
 * Third-party apps run only through Composio REST.
 */

import type { NormalizedProviderError } from "@/types";
import { listUserAccounts } from "@/lib/composio/accounts";
import {
  composioConfigured,
  composioUserId,
  executeComposioTool,
} from "@/lib/composio/client";

export type ServerActionResult = {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: NormalizedProviderError;
};

const LEGACY_TO_COMPOSIO: Record<string, string> = {
  "notion.create_page": "NOTION_CREATE_PAGE",
  "notion.search": "NOTION_SEARCH",
  "notion.append_blocks": "NOTION_APPEND_BLOCK_CHILDREN",
  "slack.post_message": "SLACK_SEND_MESSAGE",
  "slack.list_channels": "SLACK_LIST_CHANNELS",
  "buffer.create_post": "BUFFER_CREATE_UPDATE",
  "buffer.list_channels": "BUFFER_GET_PENDING_UPDATES",
  "hubspot.list_contacts": "HUBSPOT_LIST_CONTACTS",
  "hubspot.search_contacts": "HUBSPOT_SEARCH_CONTACTS",
  "hubspot.create_contact": "HUBSPOT_CREATE_CONTACT",
  "ideogram.generate_image": "IDEOGRAM_GENERATE_IMAGE",
};

function notConnected(name: string): ServerActionResult {
  return {
    ok: false,
    message: `Connect ${name} under Connections first.`,
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

function toolkitFromAction(actionId: string): string {
  return actionId.split(".")[0] || "";
}

function toComposioSlug(actionId: string): string {
  if (LEGACY_TO_COMPOSIO[actionId]) return LEGACY_TO_COMPOSIO[actionId];
  return actionId
    .split(".")
    .map((p) => p.toUpperCase())
    .join("_");
}

export async function executeServerAction(params: {
  userId: string;
  actionId: string;
  input?: Record<string, string>;
  notionDefaultParent?: string;
  connectedAccountId?: string;
  composioToolSlug?: string;
}): Promise<ServerActionResult> {
  const userId = composioUserId(params.userId || "");
  const actionId = (params.actionId || "").trim();
  const input = params.input || {};

  if (!userId) {
    return {
      ok: false,
      message: "Sign in required to run this action.",
      error: { category: "auth" },
    };
  }
  if (!actionId) return unknownAction("");

  const provider = toolkitFromAction(actionId);

  if (provider === "local_data" || provider === "vault") {
    return {
      ok: false,
      message:
        "Local actions run in the workflow engine, not as server connector actions.",
      error: { category: "validation" },
    };
  }

  if (provider === "mcp") {
    return runMcp(userId, actionId, input);
  }

  if (!composioConfigured()) {
    return {
      ok: false,
      message:
        "App integrations aren’t available right now. Please try again later.",
      error: { category: "not_configured" },
    };
  }

  try {
    const accounts = await listUserAccounts(userId);
    const active = accounts.filter(
      (a) =>
        !a.isDisabled &&
        /ACTIVE|CONNECTED|SUCCESS/i.test(a.status) &&
        (a.toolkit.toLowerCase() === provider.toLowerCase() ||
          a.toolkit.toLowerCase().includes(provider.toLowerCase()))
    );

    if (!active.length) {
      return notConnected(provider);
    }

    const connectedAccountId =
      params.connectedAccountId || active[0]?.id || undefined;
    const toolSlug = params.composioToolSlug || toComposioSlug(actionId);

    const args: Record<string, unknown> = { ...input };
    if (
      provider === "notion" &&
      params.notionDefaultParent &&
      !args.parent_id &&
      !args.parentId
    ) {
      args.parent_id = params.notionDefaultParent;
    }

    const result = await executeComposioTool({
      toolSlug,
      userId,
      arguments: args,
      connectedAccountId,
    });

    if (!result.ok) {
      return {
        ok: false,
        message: result.error || "Tool execution failed",
        data: result.data,
        error: { category: "server_error" },
      };
    }

    return {
      ok: true,
      message: "Completed via connected app.",
      data: result.data,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Provider call failed";
    const authish = /auth|token|connect|permission|unauthorized|401|403/i.test(
      msg
    );
    return {
      ok: false,
      message: msg,
      error: { category: authish ? "auth" : "server_error" },
    };
  }
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
      message: "Could not run this tool.",
      error: { category: "server_error" },
    };
  }
}
