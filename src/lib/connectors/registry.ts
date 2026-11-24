export type ConnectorUiStatus =
  | "connected"
  | "available"
  | "unavailable"
  | "coming_soon"
  | "error"
  | "loading";

/** Primary niche for Connections filtering */
export type ConnectorCategory =
  | "Productivity"
  | "Documents & Knowledge"
  | "Communication"
  | "Marketing"
  | "Design & Media"
  | "Developer Tools"
  | "AI & Automation";

export const CONNECTOR_CATEGORIES: ConnectorCategory[] = [
  "Productivity",
  "Documents & Knowledge",
  "Communication",
  "Marketing",
  "Design & Media",
  "Developer Tools",
  "AI & Automation",
];

export type ActionField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "boolean" | "url";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
};

function impl() {
  return { implemented: true, available: true } as const;
}

function soon() {
  return {
    implemented: false,
    available: false,
    unavailableReason: "Coming soon",
  } as const;
}

export type ConnectorAction = {
  id: string;
  connectorId: string;
  name: string;
  description: string;
  readOnly: boolean;
  requiresApproval: boolean;
  riskTier: "low" | "medium" | "high";
  fields: ActionField[];
  implemented: boolean;
  available: boolean;
  unavailableReason?: string;
};

export type ConnectorDefinition = {
  id: string;
  name: string;
  provider: string;
  icon: string;
  category: ConnectorCategory;
  description: string;
  detailDescription?: string;
  shortDescription?: string;
  connectionMethod: string;
  costLabel: string;
  costNote?: string;
  envHint?: string;
  configurable: boolean;
  executable: boolean;
  defaultStatus: ConnectorUiStatus;
  scopes?: string[];
  actions: ConnectorAction[];
};

/** Residual action templates for workflow steps. Third-party apps connect via Connections. */
export const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  {
    id: "notion",
    name: "Notion",
    provider: "notion",
    icon: "N",
    category: "Documents & Knowledge",
    description: "Notes & docs",
    shortDescription: "Notes & docs",
    detailDescription:
      "Connect Notion under Connections so your AI employees can search and write pages.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Uses your Notion account.",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: ["Search pages", "Create pages", "Update pages"],
    actions: [
      {
        id: "notion.search",
        connectorId: "notion",
        name: "Search",
        description: "Search pages in your Notion workspace.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "query", label: "Search query", type: "text", required: true }],
        ...impl(),
      },
      {
        id: "notion.create_page",
        connectorId: "notion",
        name: "Create page",
        description: "Create a new page in Notion.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "title", label: "Title", type: "text", required: true },
          { key: "content", label: "Content", type: "textarea", required: false },
          { key: "parent_id", label: "Parent page", type: "text", required: false },
        ],
        ...impl(),
      },
      {
        id: "notion.append_blocks",
        connectorId: "notion",
        name: "Add to page",
        description: "Append content to an existing page.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "page_id", label: "Page", type: "text", required: true },
          { key: "content", label: "Content", type: "textarea", required: true },
        ],
        ...impl(),
      },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    provider: "slack",
    icon: "S",
    category: "Communication",
    description: "Team messages",
    shortDescription: "Team messages",
    detailDescription:
      "Connect Slack under Connections so your AI employees can list channels and send messages.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Uses your Slack workspace.",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: ["List channels", "Send messages"],
    actions: [
      {
        id: "slack.list_channels",
        connectorId: "slack",
        name: "List channels",
        description: "List channels in your Slack workspace.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [],
        ...impl(),
      },
      {
        id: "slack.post_message",
        connectorId: "slack",
        name: "Send message",
        description: "Post a message to a Slack channel.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "channel", label: "Channel", type: "text", required: true },
          { key: "text", label: "Message", type: "textarea", required: true },
        ],
        ...impl(),
      },
    ],
  },
  {
    id: "buffer",
    name: "Buffer",
    provider: "buffer",
    icon: "B",
    category: "Marketing",
    description: "Social scheduling",
    shortDescription: "Social scheduling",
    detailDescription:
      "Connect Buffer under Connections so AI employees can view channels and create or schedule posts.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Uses your Buffer account.",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: ["View channels", "View posts", "Create and schedule posts"],
    actions: [
      {
        id: "buffer.list_channels",
        connectorId: "buffer",
        name: "View channels",
        description: "List channels in your Buffer account.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [],
        ...impl(),
      },
      {
        id: "buffer.list_posts",
        connectorId: "buffer",
        name: "View posts",
        description: "List recent posts for a channel.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [
          {
            key: "channel",
            label: "Channel name",
            type: "text",
            required: true,
            placeholder: "e.g. Company LinkedIn",
          },
        ],
        ...impl(),
      },
      {
        id: "buffer.create_post",
        connectorId: "buffer",
        name: "Create or schedule a post",
        description:
          "Add a post to a channel. Leave schedule time empty to use the next available slot.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          {
            key: "channel",
            label: "Channel name",
            type: "text",
            required: true,
            placeholder: "e.g. Company LinkedIn",
          },
          { key: "text", label: "Post text", type: "textarea", required: true },
          {
            key: "scheduled_at",
            label: "Schedule time (optional)",
            type: "text",
            placeholder: "Optional date and time",
            help: "Leave empty to add to the next open slot.",
          },
        ],
        ...impl(),
      },
    ],
  },
  {
    id: "ideogram",
    name: "Ideogram",
    provider: "ideogram",
    icon: "I",
    category: "Design & Media",
    description: "AI images",
    shortDescription: "AI images",
    detailDescription: "Connect image tools under Connections when available.",
    connectionMethod: "api_key",
    costLabel: "user_paid",
    costNote: "Uses your image account.",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: ["Create images from text"],
    actions: [
      {
        id: "ideogram.generate_image",
        connectorId: "ideogram",
        name: "Generate image",
        description: "Create an image from a text prompt.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [{ key: "prompt", label: "Prompt", type: "textarea", required: true }],
        ...impl(),
      },
    ],
  },
  {
    id: "mcp",
    name: "Custom tools",
    provider: "mcp",
    icon: "M",
    category: "Developer Tools",
    description: "Custom tools",
    shortDescription: "Custom tools",
    detailDescription:
      "Connect your own custom tools so AI employees can use them with your approval.",
    connectionMethod: "custom",
    costLabel: "user_paid",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: ["Approved tools only"],
    actions: [
      {
        id: "mcp.call_tool",
        connectorId: "mcp",
        name: "Run custom tool",
        description: "Run an approved custom tool.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [{ key: "tool", label: "Tool name", type: "text", required: true }],
        ...impl(),
      },
    ],
  },
  {
    id: "local_data",
    name: "Local data",
    provider: "local",
    icon: "L",
    category: "Productivity",
    description: "Lists & notes",
    shortDescription: "Lists & notes",
    connectionMethod: "local",
    costLabel: "free",
    configurable: false,
    executable: true,
    defaultStatus: "connected",
    scopes: ["Lists", "Notes", "Reports"],
    actions: [],
  },
  {
    id: "vault",
    name: "Vault",
    provider: "local",
    icon: "V",
    category: "Productivity",
    description: "Secure files",
    shortDescription: "Secure files",
    connectionMethod: "local",
    costLabel: "free",
    configurable: false,
    executable: false,
    defaultStatus: "connected",
    scopes: ["Store files"],
    actions: [],
  },
];

/** Simple workflow starter templates for the hiring desk / builder. */
export const WORKFLOW_STARTERS: {
  id: string;
  name: string;
  description: string;
  actionIds: string[];
}[] = [
  {
    id: "research-notes",
    name: "Research notes",
    description: "Search docs and save a short note.",
    actionIds: ["notion.search", "notion.create_page"],
  },
  {
    id: "team-update",
    name: "Team update",
    description: "Draft and send a team message.",
    actionIds: ["slack.post_message"],
  },
  {
    id: "social-post",
    name: "Social post",
    description: "Schedule a social post.",
    actionIds: ["buffer.create_post"],
  },
];

export function getConnector(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id);
}

export function getAction(actionId: string): ConnectorAction | undefined {
  for (const c of CONNECTOR_REGISTRY) {
    const a = c.actions.find((x) => x.id === actionId);
    if (a) return a;
  }
  return undefined;
}

export function allActions(): ConnectorAction[] {
  return CONNECTOR_REGISTRY.flatMap((c) => c.actions);
}

/** Actions safe to add to a live workflow. */
export function listAvailableActions(): ConnectorAction[] {
  return allActions().filter((a) => a.available && a.implemented);
}

export function statusBadgeClass(status: string): string {
  const s = String(status || "").toLowerCase();
  if (s === "connected")
    return "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (s === "unavailable" || s === "error")
    return "rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:bg-red-950 dark:text-red-300";
  if (s === "coming_soon")
    return "rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return "rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

export function statusLabel(status: string): string {
  const s = String(status || "").toLowerCase();
  if (s === "connected") return "Connected";
  if (s === "unavailable") return "Unavailable";
  if (s === "coming_soon") return "Coming soon";
  if (s === "error") return "Error";
  if (s === "loading") return "…";
  return "Available";
}
