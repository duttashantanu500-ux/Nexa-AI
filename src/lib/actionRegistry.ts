/**
 * Controlled action registry for deterministic workflows.
 * No paid AI required. Only actions listed here can run.
 */

export type ActionFieldType = "text" | "textarea" | "number" | "select" | "boolean";

export interface ActionField {
  key: string;
  label: string;
  type: ActionFieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  help?: string;
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  category: "data" | "web" | "logic" | "output";
  connectionId: string | null; // null = built-in, no OAuth
  fields: ActionField[];
  readOnly: boolean;
  requiresApproval: boolean;
  available: boolean;
  availabilityNote?: string;
}

export const ACTION_REGISTRY: ActionDefinition[] = [
  {
    id: "data.list_from_text",
    name: "Create list from text",
    description: "Split text into a list (one item per line or comma).",
    category: "data",
    connectionId: null,
    fields: [
      {
        key: "text",
        label: "Text",
        type: "textarea",
        required: true,
        placeholder: "Item one\nItem two\nItem three",
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
    readOnly: true,
    requiresApproval: false,
    available: true,
  },
  {
    id: "data.filter",
    name: "Filter list",
    description: "Keep only items that contain (or exclude) a keyword.",
    category: "data",
    connectionId: null,
    fields: [
      {
        key: "keyword",
        label: "Keyword",
        type: "text",
        required: true,
        placeholder: "e.g. mumbai",
      },
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
    readOnly: true,
    requiresApproval: false,
    available: true,
  },
  {
    id: "data.limit",
    name: "Limit list size",
    description: "Keep only the first N items.",
    category: "data",
    connectionId: null,
    fields: [
      {
        key: "count",
        label: "Max items",
        type: "number",
        required: true,
        placeholder: "10",
      },
    ],
    readOnly: true,
    requiresApproval: false,
    available: true,
  },
  {
    id: "data.template",
    name: "Format with template",
    description: "Turn each list item into a line using {{item}}.",
    category: "data",
    connectionId: null,
    fields: [
      {
        key: "template",
        label: "Template",
        type: "textarea",
        required: true,
        placeholder: "- {{item}}",
        help: "Use {{item}} where each list value should appear.",
      },
    ],
    readOnly: true,
    requiresApproval: false,
    available: true,
  },
  {
    id: "web.search",
    name: "Web search",
    description: "Search the public web (uses free/built-in search; quality varies).",
    category: "web",
    connectionId: "web",
    fields: [
      {
        key: "query",
        label: "Search query",
        type: "text",
        required: true,
        placeholder: "restaurants in Lucknow",
      },
      {
        key: "maxResults",
        label: "Max results",
        type: "number",
        placeholder: "8",
      },
    ],
    readOnly: true,
    requiresApproval: false,
    available: true,
  },
  {
    id: "web.read_page",
    name: "Read web page",
    description: "Fetch text from a public URL.",
    category: "web",
    connectionId: "web",
    fields: [
      {
        key: "url",
        label: "URL",
        type: "text",
        required: true,
        placeholder: "https://example.com",
      },
    ],
    readOnly: true,
    requiresApproval: false,
    available: true,
  },
  {
    id: "logic.note",
    name: "Add note",
    description: "Attach a fixed note to the workflow context.",
    category: "logic",
    connectionId: null,
    fields: [
      {
        key: "note",
        label: "Note",
        type: "textarea",
        required: true,
      },
    ],
    readOnly: true,
    requiresApproval: false,
    available: true,
  },
  {
    id: "output.report",
    name: "Build report",
    description: "Create a readable report from the current list and notes.",
    category: "output",
    connectionId: null,
    fields: [
      {
        key: "title",
        label: "Report title",
        type: "text",
        required: true,
        placeholder: "Workflow result",
      },
    ],
    readOnly: true,
    requiresApproval: false,
    available: true,
  },
  {
    id: "email.send",
    name: "Send email",
    description: "Requires Gmail connection (not available yet).",
    category: "output",
    connectionId: "gmail",
    fields: [
      { key: "to", label: "To", type: "text", required: true },
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "body", label: "Body", type: "textarea", required: true },
    ],
    readOnly: false,
    requiresApproval: true,
    available: false,
    availabilityNote: "Coming soon — Gmail is not connected",
  },
];

export function getAction(id: string): ActionDefinition | undefined {
  return ACTION_REGISTRY.find((a) => a.id === id);
}

export function availableActions(): ActionDefinition[] {
  return ACTION_REGISTRY.filter((a) => a.available);
}

export const WORKFLOW_STARTERS: {
  id: string;
  name: string;
  description: string;
  steps: { actionId: string; config: Record<string, string> }[];
}[] = [
  {
    id: "blank",
    name: "Blank workflow",
    description: "Start empty and add your own steps.",
    steps: [],
  },
  {
    id: "list_process",
    name: "List processing",
    description: "Create a list, filter it, limit size, and build a report.",
    steps: [
      {
        actionId: "data.list_from_text",
        config: { text: "", separator: "newline" },
      },
      {
        actionId: "data.filter",
        config: { keyword: "", mode: "include" },
      },
      {
        actionId: "data.limit",
        config: { count: "10" },
      },
      {
        actionId: "output.report",
        config: { title: "Filtered list" },
      },
    ],
  },
  {
    id: "research",
    name: "Research / collection",
    description: "Search the web and build a short report.",
    steps: [
      {
        actionId: "web.search",
        config: { query: "", maxResults: "8" },
      },
      {
        actionId: "data.limit",
        config: { count: "10" },
      },
      {
        actionId: "output.report",
        config: { title: "Research results" },
      },
    ],
  },
  {
    id: "email",
    name: "Email workflow",
    description: "Requires Gmail (not available yet).",
    steps: [
      {
        actionId: "email.send",
        config: { to: "", subject: "", body: "" },
      },
    ],
  },
];
