/**
 * Connector-first registry.
 * Card copy stays short; details live on /connections/[id].
 */

export type CostLabel =
  | "local_free"
  | "free_tier"
  | "user_paid"
  | "paid_api"
  | "not_configured"
  | "unsupported";

export type ConnectionMethod = "local_endpoint" | "oauth" | "api_key" | "none";

export type ConnectorUiStatus =
  | "connected"
  | "available"
  | "coming_soon"
  | "unavailable"
  | "error"
  | "setup_required"
  | "unsupported";

export interface ActionField {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "boolean" | "url";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  help?: string;
}

export interface ConnectorAction {
  id: string;
  connectorId: string;
  name: string;
  description: string;
  readOnly: boolean;
  requiresApproval: boolean;
  fields: ActionField[];
  available: boolean;
  implemented: boolean;
  riskTier?: "low" | "medium" | "high";
  unavailableReason?: string;
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  provider: string;
  description: string;
  detailDescription?: string;
  icon: string;
  connectionMethod: ConnectionMethod;
  costLabel: CostLabel;
  costNote: string;
  envHint?: string;
  configurable: boolean;
  executable: boolean;
  defaultStatus: ConnectorUiStatus;
  scopes?: string[];
  actions: ConnectorAction[];
}

const notImpl = (reason: string) => ({
  available: false as const,
  implemented: false as const,
  unavailableReason: reason,
});

const impl = () => ({
  available: true as const,
  implemented: true as const,
});

export const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  {
    id: "slack",
    name: "Slack",
    provider: "slack",
    icon: "S",
    description: "Post messages and list channels in your workspace.",
    detailDescription: "Connect Slack so agents can post messages in channels you allow.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Uses your Slack workspace.",
    envHint: "SLACK_CLIENT_ID, SLACK_CLIENT_SECRET",
    configurable: true,
    executable: false,
    defaultStatus: "unavailable",
    scopes: ["channels:read", "chat:write"],
    actions: [
      {
        id: "slack.post_message",
        connectorId: "slack",
        name: "Post message",
        description: "Post a message to a channel.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "channel", label: "Channel", type: "text", required: true },
          { key: "text", label: "Message", type: "textarea", required: true },
        ],
        ...notImpl("Slack is not fully set up yet."),
      },
      {
        id: "slack.list_channels",
        connectorId: "slack",
        name: "List channels",
        description: "List channels the bot can access.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [],
        ...notImpl("Slack is not fully set up yet."),
      },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    provider: "notion",
    icon: "N",
    description: "Create pages, add content, search pages.",
    detailDescription: "Use your Notion workspace from Nexa agents.",
    connectionMethod: "api_key",
    costLabel: "user_paid",
    costNote: "Uses your Notion workspace.",
    envHint: "NOTION_INTERNAL_TOKEN",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: ["Read content", "Update content", "Insert content"],
    actions: [
      {
        id: "notion.create_page",
        connectorId: "notion",
        name: "Create page",
        description: "Create a page (uses your default folder if set).",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "title", label: "Title", type: "text", required: true },
          { key: "content", label: "Content", type: "textarea" },
          {
            key: "parent_name",
            label: "Parent page name (optional)",
            type: "text",
            help: "Leave empty to use the default page from Connections.",
          },
        ],
        ...impl(),
      },
      {
        id: "notion.append_blocks",
        connectorId: "notion",
        name: "Add content",
        description: "Add text to an existing page.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          {
            key: "page_name",
            label: "Page name",
            type: "text",
            required: true,
            help: "Name of a page shared with Nexa.",
          },
          { key: "content", label: "Content", type: "textarea", required: true },
        ],
        ...impl(),
      },
      {
        id: "notion.search",
        connectorId: "notion",
        name: "Search pages",
        description: "Find pages Nexa can access.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "query", label: "Search", type: "text" }],
        ...impl(),
      },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    icon: "G",
    description: "Create issues and list open issues.",
    detailDescription: "Connect GitHub to open and list issues.",
    connectionMethod: "oauth",
    costLabel: "free_tier",
    costNote: "Uses your GitHub account.",
    envHint: "GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET",
    configurable: true,
    executable: false,
    defaultStatus: "unavailable",
    scopes: ["repo"],
    actions: [
      {
        id: "github.create_issue",
        connectorId: "github",
        name: "Create issue",
        description: "Open an issue in a repository.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "owner", label: "Owner", type: "text", required: true },
          { key: "repo", label: "Repository", type: "text", required: true },
          { key: "title", label: "Title", type: "text", required: true },
          { key: "body", label: "Body", type: "textarea" },
        ],
        ...notImpl("GitHub is not fully set up yet."),
      },
      {
        id: "github.list_issues",
        connectorId: "github",
        name: "List issues",
        description: "List open issues in a repository.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [
          { key: "owner", label: "Owner", type: "text", required: true },
          { key: "repo", label: "Repository", type: "text", required: true },
        ],
        ...notImpl("GitHub is not fully set up yet."),
      },
    ],
  },
  {
    id: "local_data",
    name: "Local data tools",
    provider: "builtin",
    icon: "L",
    description: "Lists, filters, and reports — runs in the app.",
    detailDescription: "Built-in tools. No external account.",
    connectionMethod: "none",
    costLabel: "local_free",
    costNote: "Runs in the app.",
    configurable: true,
    executable: true,
    defaultStatus: "connected",
    scopes: [],
    actions: [
      {
        id: "local_data.list_from_text",
        connectorId: "local_data",
        name: "Create list from text",
        description: "Split text into a list.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [
          { key: "text", label: "Text", type: "textarea", required: true },
          {
            key: "separator",
            label: "Separator",
            type: "select",
            options: [
              { value: "newline", label: "New line" },
              { value: "comma", label: "Comma" },
            ],
          },
        ],
        ...impl(),
      },
      {
        id: "local_data.filter",
        connectorId: "local_data",
        name: "Filter list",
        description: "Keep or remove items matching a keyword.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [
          { key: "keyword", label: "Keyword", type: "text", required: true },
          {
            key: "mode",
            label: "Mode",
            type: "select",
            options: [
              { value: "include", label: "Keep matches" },
              { value: "exclude", label: "Remove matches" },
            ],
          },
        ],
        ...impl(),
      },
      {
        id: "local_data.limit",
        connectorId: "local_data",
        name: "Limit list",
        description: "Keep the first N items.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "count", label: "Max items", type: "number", required: true }],
        ...impl(),
      },
      {
        id: "local_data.template",
        connectorId: "local_data",
        name: "Format with template",
        description: "Map each item with {{item}}.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "template", label: "Template", type: "textarea", required: true }],
        ...impl(),
      },
      {
        id: "local_data.report",
        connectorId: "local_data",
        name: "Build report",
        description: "Combine notes and list into a report.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "title", label: "Title", type: "text", required: true }],
        ...impl(),
      },
      {
        id: "local_data.note",
        connectorId: "local_data",
        name: "Add note",
        description: "Attach a note to the workflow context.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "note", label: "Note", type: "textarea", required: true }],
        ...impl(),
      },
    ],
  },
  {
    id: "local_comfyui",
    name: "Local ComfyUI",
    provider: "comfyui",
    icon: "C",
    description: "Generate images on your local machine.",
    detailDescription: "Point Nexa at ComfyUI on your computer.",
    connectionMethod: "local_endpoint",
    costLabel: "local_free",
    costNote: "Runs on your hardware.",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: [],
    actions: [
      {
        id: "local_comfyui.generate_image",
        connectorId: "local_comfyui",
        name: "Generate image",
        description: "Generate an image via local ComfyUI.",
        readOnly: false,
        requiresApproval: false,
        riskTier: "low",
        fields: [
          { key: "prompt", label: "Prompt", type: "textarea", required: true },
          { key: "negative_prompt", label: "Negative prompt", type: "textarea" },
          { key: "width", label: "Width", type: "number" },
          { key: "height", label: "Height", type: "number" },
          { key: "seed", label: "Seed", type: "number" },
        ],
        ...impl(),
      },
      {
        id: "local_comfyui.test_connection",
        connectorId: "local_comfyui",
        name: "Test connection",
        description: "Ping local endpoint.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [],
        ...impl(),
      },
    ],
  },
  {
    id: "gmail",
    name: "Gmail",
    provider: "google",
    icon: "M",
    description: "Send and read email via Google.",
    detailDescription: "Coming soon.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Will use your Google account when released.",
    configurable: false,
    executable: false,
    defaultStatus: "coming_soon",
    scopes: [],
    actions: [],
  },
  {
    id: "gdrive",
    name: "Google Drive",
    provider: "google",
    icon: "D",
    description: "Files and folders in Google Drive.",
    detailDescription: "Coming soon.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Coming soon.",
    configurable: false,
    executable: false,
    defaultStatus: "coming_soon",
    scopes: [],
    actions: [],
  },
  {
    id: "gsheets",
    name: "Google Sheets",
    provider: "google",
    icon: "H",
    description: "Read and write spreadsheet rows.",
    detailDescription: "Coming soon.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Coming soon.",
    configurable: false,
    executable: false,
    defaultStatus: "coming_soon",
    scopes: [],
    actions: [],
  },
  {
    id: "gcal",
    name: "Google Calendar",
    provider: "google",
    icon: "A",
    description: "Calendar events.",
    detailDescription: "Coming soon.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Coming soon.",
    configurable: false,
    executable: false,
    defaultStatus: "coming_soon",
    scopes: [],
    actions: [],
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

export function listAvailableActions(): ConnectorAction[] {
  return CONNECTOR_REGISTRY.flatMap((c) =>
    c.actions.filter((a) => a.implemented && a.available && c.executable)
  );
}

export function costLabelDisplay(label: CostLabel): string {
  const map: Record<CostLabel, string> = {
    local_free: "Free",
    free_tier: "Free tier",
    user_paid: "Your account",
    paid_api: "Paid API",
    not_configured: "Not set up",
    unsupported: "Unavailable",
  };
  return map[label];
}

export function statusLabel(status: ConnectorUiStatus): string {
  const map: Record<ConnectorUiStatus, string> = {
    connected: "Connected",
    available: "Available",
    coming_soon: "Coming soon",
    unavailable: "Unavailable",
    error: "Error",
    setup_required: "Available",
    unsupported: "Unavailable",
  };
  return map[status] || status;
}

export function statusBadgeClass(status: ConnectorUiStatus): string {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-medium";
  switch (status) {
    case "connected":
      return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300`;
    case "available":
    case "setup_required":
      return `${base} bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300`;
    case "coming_soon":
      return `${base} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`;
    case "error":
      return `${base} bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300`;
    default:
      return `${base} bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200`;
  }
}

export function connectionMethodLabel(m: ConnectionMethod): string {
  const map: Record<ConnectionMethod, string> = {
    oauth: "Sign in",
    local_endpoint: "Local",
    api_key: "Workspace link",
    none: "Built-in",
  };
  return map[m];
}

export const WORKFLOW_STARTERS: {
  id: string;
  name: string;
  description: string;
  requiresConnectors: string[];
  steps: { actionId: string; config: Record<string, string> }[];
  available: boolean;
  unavailableReason?: string;
}[] = [
  {
    id: "blank",
    name: "Blank workflow",
    description: "Start empty.",
    requiresConnectors: [],
    steps: [],
    available: true,
  },
  {
    id: "local_list",
    name: "Local list processing",
    description: "Create, filter, and report on a list.",
    requiresConnectors: ["local_data"],
    steps: [
      { actionId: "local_data.list_from_text", config: { text: "", separator: "newline" } },
      { actionId: "local_data.filter", config: { keyword: "", mode: "include" } },
      { actionId: "local_data.limit", config: { count: "20" } },
      { actionId: "local_data.report", config: { title: "List report" } },
    ],
    available: true,
  },
];
