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
  | "Sales & CRM"
  | "Design & Media"
  | "Voice & Telephony"
  | "Developer Tools"
  | "AI & Automation";

export const CONNECTOR_CATEGORIES: ConnectorCategory[] = [
  "Productivity",
  "Documents & Knowledge",
  "Communication",
  "Marketing",
  "Sales & CRM",
  "Design & Media",
  "Voice & Telephony",
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
  /** Primary business niche for filtering */
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

export const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  {
    id: "notion",
    name: "Notion",
    provider: "notion",
    icon: "N",
    category: "Documents & Knowledge",
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
    category: "Marketing",
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
            placeholder: "Optional date and time",
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
    category: "Sales & CRM",
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
        id: "hubspot.get_contact",
        connectorId: "hubspot",
        name: "Get contact",
        description: "Get a contact by ID.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "contactId", label: "Contact", type: "text", required: true }],
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
          { key: "phone", label: "Phone", type: "text", required: false },
          { key: "company", label: "Company", type: "text", required: false },
        ],
        ...impl(),
      },
      {
        id: "hubspot.update_contact",
        connectorId: "hubspot",
        name: "Update contact",
        description: "Update an existing contact.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "contactId", label: "Contact", type: "text", required: true },
          { key: "email", label: "Email", type: "text", required: false },
          { key: "firstname", label: "First name", type: "text", required: false },
          { key: "lastname", label: "Last name", type: "text", required: false },
        ],
        ...impl(),
      },
      {
        id: "hubspot.list_companies",
        connectorId: "hubspot",
        name: "List companies",
        description: "List recent companies in HubSpot.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "limit", label: "Limit", type: "number", required: false, placeholder: "20" }],
        ...impl(),
      },
      {
        id: "hubspot.search_companies",
        connectorId: "hubspot",
        name: "Search companies",
        description: "Search companies by name or domain.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "query", label: "Search", type: "text", required: true }],
        ...impl(),
      },
      {
        id: "hubspot.create_company",
        connectorId: "hubspot",
        name: "Create company",
        description: "Create a new company in HubSpot.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "name", label: "Name", type: "text", required: true },
          { key: "domain", label: "Domain", type: "text", required: false },
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
        id: "hubspot.search_deals",
        connectorId: "hubspot",
        name: "Search deals",
        description: "Search deals by name.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "query", label: "Search", type: "text", required: true }],
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
          { key: "dealstage", label: "Stage", type: "text", required: false },
        ],
        ...impl(),
      },
      {
        id: "hubspot.update_deal",
        connectorId: "hubspot",
        name: "Update deal",
        description: "Update an existing deal.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "medium",
        fields: [
          { key: "dealId", label: "Deal", type: "text", required: true },
          { key: "dealname", label: "Deal name", type: "text", required: false },
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
    category: "Design & Media",
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
    name: "Custom tools",
    provider: "mcp",
    icon: "M",
    category: "Developer Tools",
    description: "Custom tools",
    shortDescription: "Custom tools",
    detailDescription: "Connect your own custom tools so AI employees can use them with your approval.",
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
        fields: [
          { key: "tool", label: "Tool name", type: "text", required: true },
        ],
        ...impl(),
      },
    ],
  },
  {
    id: "vapi",
    name: "Voice calling",
    provider: "vapi",
    icon: "Vp",
    category: "Voice & Telephony",
    description: "Phone & voice",
    shortDescription: "Phone & voice",
    detailDescription:
      "Connect your voice calling account so AI employees can list assistants and numbers, prepare calls, and manage voice workflows. Usage is billed by your voice provider — not by Nexa.",
    connectionMethod: "api_key",
    costLabel: "user_paid",
    costNote: "Uses your voice calling account. Nexa does not fund calls.",
    configurable: true,
    executable: true,
    defaultStatus: "available",
    scopes: [
      "List assistants",
      "List phone numbers",
      "List recent calls",
      "Start outbound calls (with your approval)",
    ],
    actions: [
      {
        id: "vapi.list_assistants",
        connectorId: "vapi",
        name: "List assistants",
        description: "List voice assistants in your account.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [],
        ...impl(),
      },
      {
        id: "vapi.list_phone_numbers",
        connectorId: "vapi",
        name: "List phone numbers",
        description: "List phone numbers in your account.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [],
        ...impl(),
      },
      {
        id: "vapi.list_calls",
        connectorId: "vapi",
        name: "List calls",
        description: "List recent calls from your account.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "limit", label: "Limit", type: "number", required: false, placeholder: "20" }],
        ...impl(),
      },
      {
        id: "vapi.create_outbound_call",
        connectorId: "vapi",
        name: "Start outbound call",
        description:
          "Start an outbound call using your assistant and phone number. Requires your approval.",
        readOnly: false,
        requiresApproval: true,
        riskTier: "high",
        fields: [
          { key: "assistantId", label: "Assistant", type: "text", required: true },
          { key: "phoneNumberId", label: "Phone number", type: "text", required: true },
          {
            key: "customerNumber",
            label: "Customer phone number",
            type: "text",
            required: true,
            placeholder: "+15551234567",
          },
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
    category: "Productivity",
    description: "Lists & notes",
    shortDescription: "Lists & notes",
    detailDescription: "Built-in tools for lists, notes, and reports. No external account required.",
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
        description: "Build a list from free-form text.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "text", label: "Text", type: "textarea", required: true }],
        ...impl(),
      },
      {
        id: "local_data.filter_list",
        connectorId: "local_data",
        name: "Filter list",
        description: "Filter the current list by a keyword.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "query", label: "Filter", type: "text", required: true }],
        ...impl(),
      },
      {
        id: "local_data.limit_list",
        connectorId: "local_data",
        name: "Limit list",
        description: "Keep only the first N items.",
        readOnly: true,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "limit", label: "Limit", type: "number", required: true }],
        ...impl(),
      },
      {
        id: "local_data.add_note",
        connectorId: "local_data",
        name: "Add note",
        description: "Add a working note.",
        readOnly: false,
        requiresApproval: false,
        riskTier: "low",
        fields: [{ key: "note", label: "Note", type: "textarea", required: true }],
        ...impl(),
      },
      {
        id: "local_data.report",
        connectorId: "local_data",
        name: "Build report",
        description: "Build a short report from notes and list items.",
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
    name: "Local images",
    provider: "local",
    icon: "C",
    category: "Design & Media",
    description: "Local image studio",
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
    category: "Productivity",
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

export function getAction(id: string): ConnectorAction | undefined {
  for (const c of CONNECTOR_REGISTRY) {
    const a = c.actions.find((x) => x.id === id);
    if (a) return a;
  }
  return undefined;
}

/** Actions safe to add to a runnable agent (implemented + available + connector executable). */
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
    loading: "Loading",
  };
  return map[s] || s;
}
