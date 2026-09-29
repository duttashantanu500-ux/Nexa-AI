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
    detailDescription: "Connect your Notion workspace so agents can search and write pages.",
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
    detailDescription: "Connect your Slack workspace so agents can list channels and send messages.",
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
    detailDescription:
      "Connect your Buffer account. Agents can view channels and create or schedule posts.",
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
    id: "ideogram",
    name: "Ideogram",
    provider: "ideogram",
    icon: "I",
    description: "AI images",
    detailDescription:
      "Connect your Ideogram account. Agents can create images from text prompts using your Ideogram access.",
    connectionMethod: "api_key",
    costLabel: "user_paid",
    costNote: "Uses your Ideogram account.",
    envHint: "",
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
          {
            key: "prompt",
            label: "Prompt",
            type: "textarea",
            required: true,
            placeholder: "Describe the image you want…",
          },
          {
            key: "aspect_ratio",
            label: "Aspect ratio",
            type: "select",
            required: false,
            options: [
              { value: "1x1", label: "Square (1:1)" },
              { value: "16x9", label: "Landscape (16:9)" },
              { value: "9x16", label: "Portrait (9:16)" },
              { value: "4x3", label: "Standard (4:3)" },
              { value: "3x4", label: "Tall (3:4)" },
            ],
          },
          {
            key: "rendering_speed",
            label: "Quality",
            type: "select",
            required: false,
            options: [
              { value: "TURBO", label: "Faster" },
              { value: "DEFAULT", label: "Balanced" },
              { value: "QUALITY", label: "Higher quality" },
            ],
          },
          {
            key: "num_images",
            label: "Number of images",
            type: "text",
            required: false,
            placeholder: "1",
            help: "Between 1 and 8.",
          },
          {
            key: "negative_prompt",
            label: "Avoid (optional)",
            type: "textarea",
            required: false,
            placeholder: "Things to leave out of the image…",
          },
          {
            key: "seed",
            label: "Seed (optional)",
            type: "text",
            required: false,
            placeholder: "For reproducible results",
          },
        ],
        ...impl(),
      },
    ],
  },
  {
    id: "mcp",
    name: "Add your own MCP",
    provider: "mcp",
    icon: "MCP",
    description: "Custom tools",
    detailDescription:
      "Connect your own MCP server. Discover tools, approve the ones agents may use, and run them in workflows.",
    connectionMethod: "custom",
    costLabel: "user_paid",
    costNote: "Uses your MCP server.",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: ["Discover tools", "Run approved tools"],
    actions: [
      {
        id: "mcp.call_tool",
        connectorId: "mcp",
        name: "Run MCP tool",
        description: "Run an approved tool from your connected MCP server.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          {
            key: "tool_name",
            label: "Tool name",
            type: "text",
            required: true,
            placeholder: "Exact tool name from your server",
          },
          {
            key: "arguments_json",
            label: "Arguments (JSON)",
            type: "textarea",
            required: false,
            placeholder: '{}',
            help: "Optional JSON object passed to the tool.",
          },
        ],
        ...impl(),
      },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    icon: "G",
    description: "Code & issues",
    detailDescription: "Connect GitHub so agents can list and create issues.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Uses your GitHub account.",
    configurable: true,
    executable: false,
    defaultStatus: "coming_soon",
    scopes: ["List issues", "Create issues"],
    actions: [
      {
        id: "github.list_issues",
        connectorId: "github",
        name: "List issues",
        description: "List issues in a repository.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [
          { key: "owner", label: "Owner", type: "text", required: true },
          { key: "repo", label: "Repo", type: "text", required: true },
        ],
        ...soon(),
      },
      {
        id: "github.create_issue",
        connectorId: "github",
        name: "Create issue",
        description: "Create an issue in a repository.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "owner", label: "Owner", type: "text", required: true },
          { key: "repo", label: "Repo", type: "text", required: true },
          { key: "title", label: "Title", type: "text", required: true },
          { key: "body", label: "Body", type: "textarea", required: false },
        ],
        ...soon(),
      },
    ],
  },
  {
    id: "gmail",
    name: "Gmail",
    provider: "google",
    icon: "M",
    description: "Email",
    detailDescription: "Connect Gmail so agents can read and send email on your behalf.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    configurable: true,
    executable: false,
    defaultStatus: "coming_soon",
    scopes: ["Read email", "Send email"],
    actions: [],
  },
  {
    id: "gdrive",
    name: "Google Drive",
    provider: "google",
    icon: "D",
    description: "Files",
    detailDescription: "Connect Google Drive so agents can search and read your files.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    configurable: true,
    executable: false,
    defaultStatus: "coming_soon",
    scopes: ["Search files", "Read files"],
    actions: [],
  },
  {
    id: "gsheets",
    name: "Google Sheets",
    provider: "google",
    icon: "H",
    description: "Spreadsheets",
    detailDescription: "Connect Google Sheets so agents can read and update spreadsheets.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    configurable: true,
    executable: false,
    defaultStatus: "coming_soon",
    scopes: ["Read sheets", "Update sheets"],
    actions: [],
  },
  {
    id: "gcal",
    name: "Google Calendar",
    provider: "google",
    icon: "C",
    description: "Calendar",
    detailDescription: "Connect Google Calendar so agents can view and create events.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    configurable: true,
    executable: false,
    defaultStatus: "coming_soon",
    scopes: ["View events", "Create events"],
    actions: [],
  },
  {
    id: "local_data",
    name: "Local data",
    provider: "builtin",
    icon: "L",
    description: "Lists & reports",
    detailDescription: "Built-in tools for lists, filters, and simple reports.",
    connectionMethod: "none",
    costLabel: "free",
    configurable: false,
    executable: true,
    defaultStatus: "connected",
    actions: [
      {
        id: "local_data.list_from_text",
        connectorId: "local_data",
        name: "List from text",
        description: "Turn text into a list.",
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
        description: "Filter items by keyword.",
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
              { value: "include", label: "Include matches" },
              { value: "exclude", label: "Exclude matches" },
            ],
          },
        ],
        ...impl(),
      },
      {
        id: "local_data.report",
        connectorId: "local_data",
        name: "Make report",
        description: "Build a simple text report from the list.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "title", label: "Title", type: "text", required: false }],
        ...impl(),
      },
    ],
  },
  {
    id: "vault",
    name: "Vault",
    provider: "builtin",
    icon: "V",
    description: "Your private files",
    detailDescription: "Search and read files you have stored in Vault.",
    connectionMethod: "none",
    costLabel: "free",
    configurable: false,
    executable: true,
    defaultStatus: "connected",
    actions: [
      {
        id: "vault.search",
        connectorId: "vault",
        name: "Search Vault",
        description: "Search your stored files.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "query", label: "Query", type: "text", required: true }],
        ...impl(),
      },
      {
        id: "vault.read",
        connectorId: "vault",
        name: "Read from Vault",
        description: "Read a file by name.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "name", label: "File name", type: "text", required: true }],
        ...impl(),
      },
    ],
  },
];

export function getConnector(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id);
}

export function getAction(id: string): ConnectorAction | undefined {
  for (const c of CONNECTOR_REGISTRY) {
    const a = c.actions.find((x) => x.id === id);
    if (a) return a;
  }
  return undefined;
}

export function listAvailableActions(): ConnectorAction[] {
  return CONNECTOR_REGISTRY.flatMap((c) =>
    c.actions.filter((a) => a.implemented && a.available && c.executable)
  );
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
    loading: "Checking…",
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
    default:
      return "rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500";
  }
}
