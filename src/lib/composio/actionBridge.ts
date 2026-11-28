/**
 * Maps Nexa registry actionIds → live app tool slugs + argument shapes.
 * End-to-end bridge: hire steps → connected apps → Work Board.
 */

export type BridgedTool = {
  toolkit: string;
  toolSlug: string;
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
  "outlook.list_messages": {
    toolkit: "outlook",
    toolSlug: "OUTLOOK_LIST_MESSAGES",
    buildArgs: (config) => ({
      max_results: Number(config.max || config.limit || 10) || 10,
    }),
  },
  "googlecalendar.list_events": {
    toolkit: "googlecalendar",
    toolSlug: "GOOGLECALENDAR_LIST_EVENTS",
    buildArgs: () => ({}),
  },
  "googledrive.list_files": {
    toolkit: "googledrive",
    toolSlug: "GOOGLEDRIVE_LIST_FILES",
    buildArgs: () => ({}),
  },
  "linear.list_issues": {
    toolkit: "linear",
    toolSlug: "LINEAR_LIST_ISSUES",
    buildArgs: () => ({}),
  },
  "asana.list_tasks": {
    toolkit: "asana",
    toolSlug: "ASANA_GET_TASKS",
    buildArgs: () => ({}),
  },
  "trello.list_boards": {
    toolkit: "trello",
    toolSlug: "TRELLO_GET_BOARDS",
    buildArgs: () => ({}),
  },
  "jira.list_projects": {
    toolkit: "jira",
    toolSlug: "JIRA_GET_ALL_PROJECTS",
    buildArgs: () => ({}),
  },
};

const ALIASES: Record<string, string> = {
  "slack.send_message": "slack.post_message",
  "notion.create": "notion.create_page",
  "gmail.list": "gmail.fetch_emails",
  "gmail.fetch": "gmail.fetch_emails",
  "github.list": "github.list_repos",
  "outlook.list": "outlook.list_messages",
  "googlecalendar.list": "googlecalendar.list_events",
  "googledrive.list": "googledrive.list_files",
  "linear.list": "linear.list_issues",
  "asana.list": "asana.list_tasks",
  "trello.list": "trello.list_boards",
  "jira.list": "jira.list_projects",
};

export function resolveBridgedTool(actionId: string): BridgedTool | null {
  const id = ALIASES[actionId] || actionId;
  return MAP[id] || null;
}

export function toolkitFromActionId(actionId: string): string {
  const bridged = resolveBridgedTool(actionId);
  if (bridged) return bridged.toolkit;
  return String(actionId || "").split(".")[0] || "";
}

/** All toolkits this bridge can execute (for status messaging). */
export function bridgedToolkits(): string[] {
  return Array.from(new Set(Object.values(MAP).map((m) => m.toolkit)));
}
