/**
 * Connector-first registry.
 * External work runs only through registered connectors the user configures.
 * No default web search. No silent provider fallback.
 */

export type CostLabel =
  | "local_free"
  | "free_tier"
  | "user_paid"
  | "paid_api"
  | "not_configured"
  | "unsupported";

export type ConnectionMethod = "local_endpoint" | "oauth" | "api_key" | "none";

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
  /** Can this connector be configured in the UI today? */
  configurable: boolean;
  /** Is a real execution path implemented? */
  executable: boolean;
  actions: ConnectorAction[];
}

export const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  {
    id: "local_comfyui",
    name: "Local image engine (ComfyUI)",
    provider: "comfyui",
    description:
      "Generate images on your own machine via a local ComfyUI (or compatible) server. Free of Nexa API charges; uses your hardware.",
    connectionMethod: "local_endpoint",
    costLabel: "local_free",
    costNote:
      "Runs on your computer. You pay electricity/hardware only. Some models restrict commercial use — check the model license.",
    configurable: true,
    executable: true,
    actions: [
      {
        id: "local_comfyui.generate_image",
        connectorId: "local_comfyui",
        name: "Generate image",
        description: "Send a prompt to your local ComfyUI endpoint and wait for a result URL or base64 image.",
        readOnly: false,
        requiresApproval: false,
        available: true,
        fields: [
          {
            key: "prompt",
            label: "Prompt",
            type: "textarea",
            required: true,
            placeholder: "A clean product photo of…",
          },
          {
            key: "negative_prompt",
            label: "Negative prompt",
            type: "textarea",
            placeholder: "blurry, low quality",
          },
          {
            key: "width",
            label: "Width",
            type: "number",
            placeholder: "512",
          },
          {
            key: "height",
            label: "Height",
            type: "number",
            placeholder: "512",
          },
          {
            key: "seed",
            label: "Seed (optional)",
            type: "number",
            placeholder: "-1",
          },
        ],
      },
      {
        id: "local_comfyui.test_connection",
        connectorId: "local_comfyui",
        name: "Test connection",
        description: "Ping the local endpoint to verify it is reachable.",
        readOnly: true,
        requiresApproval: false,
        available: true,
        fields: [],
      },
    ],
  },
  {
    id: "local_data",
    name: "Local data tools",
    provider: "builtin",
    description:
      "Deterministic list and text tools that run in Nexa with no external API.",
    connectionMethod: "none",
    costLabel: "local_free",
    costNote: "Runs in the app. No third-party API charges.",
    configurable: true,
    executable: true,
    actions: [
      {
        id: "local_data.list_from_text",
        connectorId: "local_data",
        name: "Create list from text",
        description: "Split text into a list (lines or commas).",
        readOnly: true,
        requiresApproval: false,
        available: true,
        fields: [
          {
            key: "text",
            label: "Text",
            type: "textarea",
            required: true,
            placeholder: "Item one\nItem two",
          },
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
      },
      {
        id: "local_data.filter",
        connectorId: "local_data",
        name: "Filter list",
        description: "Keep or remove items matching a keyword.",
        readOnly: true,
        requiresApproval: false,
        available: true,
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
      },
      {
        id: "local_data.limit",
        connectorId: "local_data",
        name: "Limit list",
        description: "Keep the first N items.",
        readOnly: true,
        requiresApproval: false,
        available: true,
        fields: [
          { key: "count", label: "Max items", type: "number", required: true, placeholder: "10" },
        ],
      },
      {
        id: "local_data.template",
        connectorId: "local_data",
        name: "Format with template",
        description: "Map each item with {{item}}.",
        readOnly: true,
        requiresApproval: false,
        available: true,
        fields: [
          {
            key: "template",
            label: "Template",
            type: "textarea",
            required: true,
            placeholder: "- {{item}}",
          },
        ],
      },
      {
        id: "local_data.report",
        connectorId: "local_data",
        name: "Build report",
        description: "Combine notes and list into a readable report.",
        readOnly: true,
        requiresApproval: false,
        available: true,
        fields: [
          { key: "title", label: "Title", type: "text", required: true, placeholder: "Workflow result" },
        ],
      },
      {
        id: "local_data.note",
        connectorId: "local_data",
        name: "Add note",
        description: "Attach a note to the workflow context.",
        readOnly: true,
        requiresApproval: false,
        available: true,
        fields: [{ key: "note", label: "Note", type: "textarea", required: true }],
      },
    ],
  },
  {
    id: "buffer",
    name: "Buffer",
    provider: "buffer",
    description: "Schedule or publish social posts through Buffer.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote:
      "Requires your Buffer account. Buffer may charge for plans. Nexa does not pay Buffer usage for you. OAuth integration is not implemented yet.",
    configurable: false,
    executable: false,
    actions: [
      {
        id: "buffer.create_draft",
        connectorId: "buffer",
        name: "Create draft post",
        description: "Create a draft in Buffer (not published until you approve in Buffer or via publish action).",
        readOnly: false,
        requiresApproval: true,
        available: false,
        unavailableReason: "Buffer OAuth is not implemented yet. Connect is unavailable.",
        fields: [
          { key: "text", label: "Caption", type: "textarea", required: true },
          { key: "channel", label: "Channel", type: "text", required: true },
        ],
      },
      {
        id: "buffer.schedule",
        connectorId: "buffer",
        name: "Schedule post",
        description: "Schedule a post. Status will be scheduled, not published, until Buffer posts it.",
        readOnly: false,
        requiresApproval: true,
        available: false,
        unavailableReason: "Buffer OAuth is not implemented yet.",
        fields: [
          { key: "text", label: "Caption", type: "textarea", required: true },
          { key: "channel", label: "Channel", type: "text", required: true },
          { key: "scheduled_at", label: "Schedule time (ISO)", type: "text", required: true },
        ],
      },
    ],
  },
  {
    id: "gmail",
    name: "Gmail",
    provider: "google",
    description: "Email actions through your Google account.",
    connectionMethod: "oauth",
    costLabel: "user_paid",
    costNote: "Uses your Google account. OAuth not implemented yet.",
    configurable: false,
    executable: false,
    actions: [
      {
        id: "gmail.send",
        connectorId: "gmail",
        name: "Send email",
        description: "Send an email. Requires approval by default.",
        readOnly: false,
        requiresApproval: true,
        available: false,
        unavailableReason: "Gmail OAuth is not implemented yet.",
        fields: [
          { key: "to", label: "To", type: "text", required: true },
          { key: "subject", label: "Subject", type: "text", required: true },
          { key: "body", label: "Body", type: "textarea", required: true },
        ],
      },
    ],
  },
  {
    id: "web_search",
    name: "Web search",
    provider: "optional",
    description:
      "Optional web search. Not enabled by default. Not used as a fallback for other connectors.",
    connectionMethod: "api_key",
    costLabel: "unsupported",
    costNote:
      "Disabled in this MVP. Will only appear if you explicitly enable a search provider later.",
    configurable: false,
    executable: false,
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
    c.actions.filter((a) => a.available && c.executable)
  );
}

export function costLabelDisplay(label: CostLabel): string {
  const map: Record<CostLabel, string> = {
    local_free: "Local / Free",
    free_tier: "Free tier",
    user_paid: "User-paid provider",
    paid_api: "Paid API",
    not_configured: "Not configured",
    unsupported: "Not available",
  };
  return map[label];
}

/** Workflow starters — only when underlying actions exist */
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
    description: "Create, filter, and report on a list — fully local, no external API.",
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
    id: "local_image",
    name: "Local image generation",
    description: "Generate an image via your local ComfyUI server. Requires endpoint setup in Connections.",
    requiresConnectors: ["local_comfyui"],
    steps: [
      {
        actionId: "local_comfyui.generate_image",
        config: {
          prompt: "",
          negative_prompt: "",
          width: "512",
          height: "512",
          seed: "-1",
        },
      },
      {
        actionId: "local_data.note",
        config: { note: "Review generated image before any publishing step." },
      },
    ],
    available: true,
  },
  {
    id: "image_to_buffer",
    name: "Image → Buffer publish",
    description: "Requires working Leonardo/ComfyUI and Buffer connectors.",
    requiresConnectors: ["local_comfyui", "buffer"],
    steps: [],
    available: false,
    unavailableReason:
      "Buffer OAuth is not implemented. Local image generation works alone after you set the ComfyUI endpoint.",
  },
];
