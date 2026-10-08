export type ConnectorUiStatus =
  | "connected"
  | "available"
  | "unavailable"
  | "coming_soon"
  | "error"
  | "loading";

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

export const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  {
    id: "notion",
    name: "Notion",
    provider: "notion",
    icon: "N",
    description: "Notes & docs",
    shortDescription: "Notes & docs",
    detailDescription: "Connect your Notion workspace so your AI employees can search and write pages.",
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
          { key: "parent_id", label: "Parent page id", type: "text", required: false },
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
          { key: "page_id", label: "Page id", type: "text", required: true },
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
    description: "Team messages",
    shortDescription: "Team messages",
    detailDescription: "Connect your Slack workspace so your AI employees can list channels and send messages.",
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
    description: "Social scheduling",
    shortDescription: "Social scheduling",
    detailDescription:
      "Connect your Buffer account. Your AI employees can view channels and create or schedule posts.",
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
            placeholder: "2026-03-10T15:00:00.000Z",
            help: "Leave empty to add to the next queue slot.",
          },
        ],
        ...impl(),
      },
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    provider: "hubspot",
    icon: "H",
    description: "CRM",
    shortDescription: "CRM",
    detailDescription:
      "Connect your HubSpot account so your AI employees can list, search, create, and update contacts, companies, and deals.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Uses your HubSpot account.",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: ["Contacts read/write", "Companies read/write", "Deals read/write"],
    actions: [
      {
        id: "hubspot.list_contacts",
        connectorId: "hubspot",
        name: "List contacts",
        description: "List recent contacts in HubSpot.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "limit", label: "Limit", type: "number", required: false, placeholder: "20" }],
        ...impl(),
      },
      {
        id: "hubspot.search_contacts",
        connectorId: "hubspot",
        name: "Search contacts",
        description: "Search contacts by name or email.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "query", label: "Search", type: "text", required: true }],
        ...impl(),
      },
      {
        id: "hubspot.create_contact",
        connectorId: "hubspot",
        name: "Create contact",
        description: "Create a new contact in HubSpot.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "email", label: "Email", type: "text", required: true },
          { key: "firstname", label: "First name", type: "text", required: false },
          { key: "lastname", label: "Last name", type: "text", required: false },
        ],
        ...impl(),
      },
      {
        id: "hubspot.list_deals",
        connectorId: "hubspot",
        name: "List deals",
        description: "List recent deals in HubSpot.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "limit", label: "Limit", type: "number", required: false, placeholder: "20" }],
        ...impl(),
      },
      {
        id: "hubspot.create_deal",
        connectorId: "hubspot",
        name: "Create deal",
        description: "Create a new deal in HubSpot.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "dealname", label: "Deal name", type: "text", required: true },
          { key: "amount", label: "Amount", type: "text", required: false },
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
    description: "AI images",
    shortDescription: "AI images",
    detailDescription: "Connect your Ideogram account. Your AI employees can create images from text prompts.",
    connectionMethod: "api_key",
    costLabel: "user_paid",
    costNote: "Uses your Ideogram account.",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: ["Create images from text"],
    actions: [
      {
        id: "ideogram.generate_image",
        connectorId: "ideogram",
        name: "Generate image",
        description: "Create an image from a text prompt with Ideogram.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "prompt", label: "Prompt", type: "textarea", required: true },
        ],
        ...impl(),
      },
    ],
  },
  {
    id: "mcp",
    name: "MCP",
    provider: "mcp",
    icon: "M",
    description: "Custom tools",
    shortDescription: "Custom tools",
    detailDescription: "Connect a Model Context Protocol server for custom tools.",
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
        name: "Call tool",
        description: "Run an approved MCP tool.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "tool", label: "Tool name", type: "text", required: true },
        ],
        ...impl(),
      },
    ],
  },
  {
    id: "local_data",
    name: "Local data",
    provider: "local",
    icon: "L",
    description: "Lists & notes",
    shortDescription: "Lists & notes",
    connectionMethod: "local",
    costLabel: "free",
    configurable: false,
    executable: true,
    defaultStatus: "connected",
    actions: [
      {
        id: "local_data.list_from_text",
        connectorId: "local_data",
        name: "List from text",
        description: "Build a list from text.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "text", label: "Text", type: "textarea", required: true }],
        ...impl(),
      },
      {
        id: "local_data.report",
        connectorId: "local_data",
        name: "Report",
        description: "Build a text report.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "title", label: "Title", type: "text", required: false }],
        ...impl(),
      },
    ],
  },
  {
    id: "local_comfyui",
    name: "ComfyUI",
    provider: "local",
    icon: "C",
    description: "Local images",
    shortDescription: "Local images",
    connectionMethod: "local",
    costLabel: "free",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    actions: [],
  },
  {
    id: "vault",
    name: "Vault",
    provider: "local",
    icon: "V",
    description: "Secure storage",
    shortDescription: "Secure storage",
    connectionMethod: "local",
    costLabel: "free",
    configurable: false,
    executable: true,
    defaultStatus: "connected",
    actions: [],
  },
];

export function getConnector(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id);
}

export function getAction(actionId: string): (ConnectorAction & { connectionId?: string }) | undefined {
  for (const c of CONNECTOR_REGISTRY) {
    const a = c.actions.find((x) => x.id === actionId);
    if (a) return { ...a, connectionId: c.id };
  }
  return undefined;
}

export const WORKFLOW_STARTERS: { id: string; name: string; description: string; actionIds: string[] }[] =
  [];

export function statusLabel(s: ConnectorUiStatus): string {
  const map: Record<ConnectorUiStatus, string> = {
    connected: "Connected",
    available: "Available",
    unavailable: "Unavailable",
    coming_soon: "Coming soon",
    error: "Needs attention",
    loading: "Available",
  };
  return map[s] || s;
}

export function statusBadgeClass(s: ConnectorUiStatus): string {
  switch (s) {
    case "connected":
      return "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "available":
      return "rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
    case "error":
      return "rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300";
    case "coming_soon":
      return "rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
    case "unavailable":
      return "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "loading":
      return "rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
    default:
      return "rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500";
  }
}
