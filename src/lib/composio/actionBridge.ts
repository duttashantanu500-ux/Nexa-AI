/**
 * Maps Nexa registry actionIds → Composio tool slugs + argument shapes.
 * This is the end-to-end bridge: hire steps → live connected apps.
 */

export type BridgedTool = {
  toolkit: string;
  toolSlug: string;
  /** Build tool arguments from step config + runtime context. */
  buildArgs: (
    config: Record<string, string>,
    ctx?: { list?: string[]; notes?: string[]; report?: string }
  ) => Record<string, unknown>;
};

const MAP: Record<string, BridgedTool> = {
  "slack.post_message": {
    toolkit: "slack",
    toolSlug: "SLACK_SEND_MESSAGE",
    buildArgs: (config, ctx) => ({
      channel: config.channel || config.channelId || config.channel_id || "",
      text:
        config.text ||
        config.message ||
        ctx?.report ||
        (ctx?.notes || []).join("\n") ||
        "",
    }),
  },
  "slack.list_channels": {
    toolkit: "slack",
    toolSlug: "SLACK_LIST_CHANNELS",
    buildArgs: () => ({}),
  },
  "notion.create_page": {
    toolkit: "notion",
    toolSlug: "NOTION_CREATE_PAGE",
    buildArgs: (config, ctx) => ({
      parent_id: config.parentId || config.parent_id || config.parent || "",
      title: config.title || "Nexa note",
      content:
        config.content ||
        ctx?.report ||
        (ctx?.notes || []).join("\n") ||
        "",
    }),
  },
  "notion.search": {
    toolkit: "notion",
    toolSlug: "NOTION_SEARCH",
    buildArgs: (config) => ({
      query: config.query || config.q || "",
    }),
  },
  "github.list_repos": {
    toolkit: "github",
    toolSlug: "GITHUB_LIST_REPOS_FOR_AUTHENTICATED_USER",
    buildArgs: () => ({}),
  },
  "gmail.fetch_emails": {
    toolkit: "gmail",
    toolSlug: "GMAIL_FETCH_EMAILS",
    buildArgs: (config) => ({
      max_results: Number(config.max || config.limit || 5) || 5,
    }),
  },
};

/** Optional aliases if older proposals used different ids */
const ALIASES: Record<string, string> = {
  "slack.send_message": "slack.post_message",
  "notion.create": "notion.create_page",
  "gmail.list": "gmail.fetch_emails",
  "github.list": "github.list_repos",
};

export function resolveBridgedTool(actionId: string): BridgedTool | null {
  const id = ALIASES[actionId] || actionId;
  return MAP[id] || null;
}

/** Infer toolkit slug from actionId prefix (slack.*, notion.*, …). */
export function toolkitFromActionId(actionId: string): string {
  const bridged = resolveBridgedTool(actionId);
  if (bridged) return bridged.toolkit;
  return String(actionId || "").split(".")[0] || "";
}
