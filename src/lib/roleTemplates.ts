/**
 * Hiring Desk role templates.
 * Only describe capabilities the product can actually support today.
 * Templates seed the AI Employee Builder — they do not invent new execution paths.
 */

export type RoleTemplateId =
  | "marketing"
  | "sales"
  | "research"
  | "operations";

export interface RoleTemplate {
  id: RoleTemplateId;
  name: string;
  jobTitle: string;
  department: string;
  summary: string;
  responsibilities: string[];
  /** Connector ids from the registry that this role typically needs */
  suggestedTools: string[];
  /** Prompt sent into the existing AI Employee Builder */
  builderPrompt: string;
  limitations: string;
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "marketing",
    name: "Marketing Employee",
    jobTitle: "Marketing Specialist",
    department: "Marketing",
    summary:
      "Drafts and organizes marketing notes, posts, and channel updates using tools you connect.",
    responsibilities: [
      "Summarize campaign notes in Notion",
      "Draft social posts for review (Buffer when connected)",
      "Share updates in Slack when connected",
    ],
    suggestedTools: ["notion", "slack", "buffer"],
    builderPrompt:
      "Hire a Marketing Employee. Job title: Marketing Specialist. Department: Marketing. Responsibilities: organize marketing notes in Notion, draft social posts for Buffer when available, and post status updates to Slack when connected. Prefer approval before publishing. Schedule: weekly if useful.",
    limitations:
      "Cannot invent brand strategy or post without your connected tools and approvals.",
  },
  {
    id: "sales",
    name: "Sales Employee",
    jobTitle: "Sales Operations",
    department: "Sales",
    summary:
      "Helps with CRM hygiene and deal follow-ups using HubSpot when connected.",
    responsibilities: [
      "Review and summarize HubSpot deals",
      "Draft follow-up notes",
      "Flag items that need human outreach",
    ],
    suggestedTools: ["hubspot", "slack"],
    builderPrompt:
      "Hire a Sales Employee. Job title: Sales Operations. Department: Sales. Responsibilities: review HubSpot deals, summarize pipeline changes, draft follow-up notes, and optionally notify Slack. Require approval before changing CRM records. Schedule: daily or weekly as fits.",
    limitations:
      "Does not send cold outreach or change deals without your approval and a connected HubSpot account.",
  },
  {
    id: "research",
    name: "Research Employee",
    jobTitle: "Research Analyst",
    department: "Strategy",
    summary:
      "Runs structured research missions and produces reports you can reuse.",
    responsibilities: [
      "Search and read public web sources",
      "Produce structured research reports",
      "Save findings to Notion when connected",
    ],
    suggestedTools: ["notion", "local_data"],
    builderPrompt:
      "Hire a Research Employee. Job title: Research Analyst. Department: Strategy. Responsibilities: run research on topics I specify, filter results, produce a clear report, and optionally save notes to Notion. Use only public web and connected tools.",
    limitations:
      "Research quality depends on public sources; not a substitute for licensed data providers.",
  },
  {
    id: "operations",
    name: "Operations Employee",
    jobTitle: "Operations Coordinator",
    department: "Operations",
    summary:
      "Keeps internal notes, checklists, and team updates organized.",
    responsibilities: [
      "Maintain operating notes in Notion",
      "Post routine updates to Slack",
      "Turn checklists into clear summaries",
    ],
    suggestedTools: ["notion", "slack"],
    builderPrompt:
      "Hire an Operations Employee. Job title: Operations Coordinator. Department: Operations. Responsibilities: maintain internal notes and checklists in Notion, summarize status, and post routine updates to Slack when connected. Prefer read-and-summarize first; require approval for external posts.",
    limitations:
      "Does not manage payroll, legal, or systems outside connected tools.",
  },
];

export function getRoleTemplate(id: string): RoleTemplate | undefined {
  return ROLE_TEMPLATES.find((t) => t.id === id);
}
