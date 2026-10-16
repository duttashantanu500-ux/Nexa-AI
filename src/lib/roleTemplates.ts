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
      "Capture campaign briefs as notes",
      "Draft marketing summaries locally",
      "Save to Notion and draft social posts when those tools are connected",
    ],
    suggestedTools: ["notion", "slack", "buffer", "local_data"],
    builderPrompt: [
      "Hire a Marketing Employee.",
      "Job title: Marketing Specialist. Department: Marketing.",
      "CRITICAL: Always include these local steps first, even if Buffer or Slack are not connected:",
      "1) local_data.note — capture the campaign brief or topic from my input",
      "2) local_data.report — draft a short marketing summary",
      "Then add when useful (do not drop the local steps above):",
      "3) notion.create_page — save the summary to Notion (requires approval)",
      "4) buffer.create_post — draft a social post for Buffer when connected (requires approval)",
      "5) slack.post_message — optionally notify a Slack channel (requires approval)",
      "Never replace steps 1–2 with only Buffer or Slack steps. Offline Buffer must not remove local_data work.",
      "Prefer approval before any publish. Schedule: weekly if useful.",
    ].join(" "),
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
    builderPrompt: [
      "Hire a Sales Employee.",
      "Job title: Sales Operations. Department: Sales.",
      "Build a reusable workflow with these concrete steps (use only real Nexa actions):",
      "1) hubspot.list_deals — load recent deals",
      "2) hubspot.list_contacts — load recent contacts for context",
      "3) local_data.report — write a pipeline summary and follow-up list",
      "4) notion.create_page — save the summary to Notion when connected (requires approval)",
      "5) slack.post_message — optionally post a short update to Slack (requires approval)",
      "Do not create or update HubSpot records in the default hire unless I ask; require approval for any CRM write.",
      "Schedule: daily or weekly as fits.",
    ].join(" "),
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
      "Turn a research brief into structured notes",
      "Filter and organize findings",
      "Produce a clear report and save to Notion when connected",
    ],
    suggestedTools: ["notion", "local_data"],
    builderPrompt: [
      "Hire a Research Employee.",
      "Job title: Research Analyst. Department: Strategy.",
      "Build a reusable multi-step research workflow (use only real Nexa actions — not a single Filter list step):",
      "1) local_data.list_from_text — turn my research brief / sources into a working list",
      "2) local_data.filter — keep only relevant items by keyword",
      "3) local_data.limit — keep the top findings",
      "4) local_data.note — capture key insights and caveats",
      "5) local_data.report — produce a structured research report with title and sections",
      "6) notion.create_page — save the report to Notion when connected (requires approval)",
      "Name: Research Analyst. Purpose: Provide actionable insights for strategy decisions.",
      "Do not invent licensed data; use only public input I provide and connected tools.",
    ].join(" "),
    limitations:
      "Research quality depends on the brief and public sources; not a substitute for licensed data providers.",
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
    builderPrompt: [
      "Hire an Operations Employee.",
      "Job title: Operations Coordinator. Department: Operations.",
      "Build a reusable workflow with these concrete steps (use only real Nexa actions):",
      "1) local_data.list_from_text — turn my checklist or status notes into a list",
      "2) local_data.filter — highlight items that need attention",
      "3) local_data.report — produce a clear status summary",
      "4) notion.create_page — save operating notes to Notion when connected (requires approval)",
      "5) slack.post_message — post a short routine update to Slack when connected (requires approval)",
      "Prefer read-and-summarize first; require approval for external posts.",
    ].join(" "),
    limitations:
      "Does not manage payroll, legal, or systems outside connected tools.",
  },
];

export function getRoleTemplate(id: string): RoleTemplate | undefined {
  return ROLE_TEMPLATES.find((t) => t.id === id);
}
