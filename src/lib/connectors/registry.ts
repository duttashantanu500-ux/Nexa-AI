/**
 * Connector-first registry.
 * `implemented` mirrors real provider/local execution capability.
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
  | "setup_required"
  | "coming_soon"
  | "unsupported"
  | "available";

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
  /** @deprecated prefer implemented */
  available: boolean;
  /** Spec: only true when real execution path exists and verified */
  implemented: boolean;
  riskTier?: "low" | "medium" | "high";
  unavailableReason?: string;
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  provider: string;
  description: string;
  connectionMethod: ConnectionMethod;
  costLabel: CostLabel;
  costNote: string;
  envHint?: string;
  configurable: boolean;
  executable: boolean;
  defaultStatus: ConnectorUiStatus;
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
    description: "Read channels, post messages, and notify teams through your Slack workspace.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Uses your Slack workspace. Nexa does not pay Slack for you.",
    envHint: "SLACK_CLIENT_ID, SLACK_CLIENT_SECRET",
    configurable: true,
    executable: false,
    defaultStatus: "setup_required",
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
          { key: "channel", label: "Channel ID or name", type: "text", required: true },
          { key: "text", label: "Message", type: "textarea", required: true },
        ],
        ...notImpl("Slack OAuth is not configured; action not implemented end-to-end."),
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
        ...notImpl("Slack OAuth is not configured; action not implemented end-to-end."),
      },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    provider: "notion",
    description: "Create pages and database rows in your Notion workspace.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Uses your Notion workspace.",
    envHint: "NOTION_CLIENT_ID, NOTION_CLIENT_SECRET",
    configurable: true,
    executable: false,
    defaultStatus: "setup_required",
    actions: [
      {
        id: "notion.create_page",
        connectorId: "notion",
        name: "Create page",
        description: "Create a page under a parent page or database.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "parent_id", label: "Parent page/database ID", type: "text", required: true },
          { key: "title", label: "Title", type: "text", required: true },
          { key: "content", label: "Content", type: "textarea" },
        ],
        ...notImpl("Notion OAuth is not configured; action not implemented end-to-end."),
      },
      {
        id: "notion.append_blocks",
        connectorId: "notion",
        name: "Append content",
        description: "Append text blocks to an existing page.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "page_id", label: "Page ID", type: "text", required: true },
          { key: "content", label: "Content", type: "textarea", required: true },
        ],
        ...notImpl("Notion OAuth is not configured; action not implemented end-to-end."),
      },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    description: "Create issues, comment on PRs, and read repository data.",
    connectionMethod: "oauth",
    costLabel: "free_tier",
    costNote: "Uses your GitHub account. Subject to API rate limits.",
    envHint: "GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET",
    configurable: true,
    executable: false,
    defaultStatus: "setup_required",
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
        ...notImpl("GitHub OAuth is not configured; action not implemented end-to-end."),
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
        ...notImpl("GitHub OAuth is not configured; action not implemented end-to-end."),
      },
    ],
  },
  {
    id: "local_data",
    name: "Local data tools",
    provider: "builtin",
    description: "Deterministic list and text tools that run in Nexa with no external API.",
    connectionMethod: "none",
    costLabel: "local_free",
    costNote: "Runs in the app. No third-party API charges.",
    configurable: true,
    executable: true,
    defaultStatus: "connected",
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
          { key: "text", label: "Text", type: "textarea", required: true, placeholder: "Item one\nItem two" },
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
        fields: [{ key: "count", label: "Max items", type: "number", required: true, placeholder: "10" }],
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
        fields: [{ key: "template", label: "Template", type: "textarea", required: true, placeholder: "- {{item}}" }],
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
        fields: [{ key: "title", label: "Title", type: "text", required: true, placeholder: "Workflow result" }],
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
    name: "Local image engine (ComfyUI)",
    provider: "comfyui",
    description: "Optional local image generation on your machine.",
    connectionMethod: "local_endpoint",
    costLabel: "local_free",
    costNote: "Runs on your hardware. Check model licenses for commercial use.",
    configurable: true,
    executable: true,
    defaultStatus: "setup_required",
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
          { key: "width", label: "Width", type: "number", placeholder: "512" },
          { key: "height", label: "Height", type: "number", placeholder: "512" },
          { key: "seed", label: "Seed", type: "number", placeholder: "-1" },
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
    description: "Send and read email via Google.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Requires administrator Google OAuth setup.",
    envHint: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET",
    configurable: false,
    executable: false,
    defaultStatus: "setup_required",
    actions: [
      {
        id: "gmail.send",
        connectorId: "gmail",
        name: "Send email",
        description: "Send an email.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "high",
        fields: [
          { key: "to", label: "To", type: "text", required: true },
          { key: "subject", label: "Subject", type: "text", required: true },
          { key: "body", label: "Body", type: "textarea", required: true },
        ],
        ...notImpl("Google OAuth is not configured by the Nexa administrator."),
      },
    ],
  },
  {
    id: "gdrive",
    name: "Google Drive",
    provider: "google",
    description: "Files and folders in Google Drive.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Requires administrator Google OAuth setup.",
    configurable: false,
    executable: false,
    defaultStatus: "setup_required",
    actions: [],
  },
  {
    id: "gsheets",
    name: "Google Sheets",
    provider: "google",
    description: "Read and write spreadsheet rows.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Requires administrator Google OAuth setup.",
    configurable: false,
    executable: false,
    defaultStatus: "setup_required",
    actions: [],
  },
  {
    id: "gcal",
    name: "Google Calendar",
    provider: "google",
    description: "Calendar events.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Requires administrator Google OAuth setup.",
    configurable: false,
    executable: false,
    defaultStatus: "setup_required",
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

/** Only implemented + available actions may be added to live workflows */
export function listAvailableActions(): ConnectorAction[] {
  return CONNECTOR_REGISTRY.flatMap((c) =>
    c.actions.filter((a) => a.implemented && a.available && c.executable)
  );
}

export function costLabelDisplay(label: CostLabel): string {
  const map: Record<CostLabel, string> = {
    local_free: "Local / Free",
    free_tier: "Free tier",
    user_paid: "User-owned account",
    paid_api: "Paid API",
    not_configured: "Not configured",
    unsupported: "Unsupported",
  };
  return map[label];
}

export function statusLabel(status: ConnectorUiStatus): string {
  const map: Record<ConnectorUiStatus, string> = {
    connected: "Connected",
    setup_required: "Setup required",
    coming_soon: "Coming soon",
    unsupported: "Unsupported",
    available: "Available",
  };
  return map[status];
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
    description: "Start empty and add steps from available connectors.",
    requiresConnectors: [],
    steps: [],
    available: true,
  },
  {
    id: "local_list",
    name: "Local list processing",
    description: "Create, filter, and report on a list — fully local.",
    requiresConnectors: ["local_data"],
    steps: [
      { actionId: "local_data.list_from_text", config: { text: "", separator: "newline" } },
      { actionId: "local_data.filter", config: { keyword: "", mode: "include" } },
      { actionId: "local_data.limit", config: { count: "20" } },
      { actionId: "local_data.report", config: { title: "List report" } },
    ],
    available: true,
  },
  {
    id: "slack_to_notion",
    name: "Slack → Notion",
    description: "Example bridge: capture a Slack message into a Notion page.",
    requiresConnectors: ["slack", "notion"],
    steps: [],
    available: false,
    unavailableReason: "Connect Slack and Notion first (OAuth + implemented actions required).",
  },
  {
    id: "github_issue",
    name: "GitHub issue from notes",
    description: "Turn structured notes into a GitHub issue.",
    requiresConnectors: ["github", "local_data"],
    steps: [],
    available: false,
    unavailableReason: "Connect GitHub first (OAuth + implemented actions required).",
  },
];
