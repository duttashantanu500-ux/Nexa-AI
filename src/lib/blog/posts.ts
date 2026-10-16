export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO date
  keywords: string[];
  /** Paragraphs + optional simple headings as markdown-ish blocks */
  sections: { heading?: string; paragraphs: string[] }[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "what-is-an-ai-employee",
    title: "What is an AI employee? A practical guide",
    description:
      "An AI employee is a reusable AI agent with a clear role, tools, and workflow — not a one-off chat. Learn how AI employees differ from chatbots and how Nexa helps you hire them.",
    date: "2026-10-15",
    keywords: ["AI employee", "AI employees", "AI agent", "Nexa"],
    sections: [
      {
        paragraphs: [
          "An AI employee is a configured AI agent that owns a job: research, marketing drafts, CRM updates, or operations checklists. Unlike a one-shot chatbot reply, an AI employee has a role, connected tools, and a workflow it can run again and again.",
          "Teams use AI employees to handle routine work while a human still approves sensitive steps — posting publicly, writing to a CRM, or changing important docs.",
        ],
      },
      {
        heading: "AI employee vs chatbot",
        paragraphs: [
          "A chatbot answers questions in the moment. An AI employee is hired for ongoing work: it knows which tools to use (Notion, Slack, HubSpot, Buffer), what steps to take, and when to ask for approval.",
          "That difference is why founders search for AI employees and AI teams instead of only “chatbots.” They want capacity, not just conversation.",
        ],
      },
      {
        heading: "How Nexa treats AI employees",
        paragraphs: [
          "On Nexa you describe the role, connect tools, and hire an AI employee into your AI team. Runs show up on the Work Board with history and approvals. Start free with up to three AI employees, then scale on Pro.",
        ],
      },
    ],
  },
  {
    slug: "build-your-ai-team",
    title: "How to build an AI team that actually does work",
    description:
      "Building an AI team means assigning clear roles, connecting real tools, and tracking runs — not collecting random prompts. Here’s a simple way to structure AI employees on Nexa.",
    date: "2026-10-15",
    keywords: ["AI team", "AI employees", "digital workforce", "Nexa"],
    sections: [
      {
        paragraphs: [
          "An AI team is a small set of AI employees with complementary roles — for example research, content, and CRM hygiene. Each member has tools and a workflow. Together they form a digital workforce you supervise.",
        ],
      },
      {
        heading: "Start with three roles",
        paragraphs: [
          "Most operators do well starting with three AI employees: one for research and notes, one for marketing or social drafts, and one for sales or ops follow-ups. That matches free-tier limits on many platforms, including Nexa’s Free plan.",
          "Give each role a narrow job description. Vague agents produce vague output; specific AI employees produce usable drafts and structured updates.",
        ],
      },
      {
        heading: "Connect tools before you scale",
        paragraphs: [
          "An AI team only works where your data lives. Connect Notion for docs, Slack for updates, HubSpot for contacts, and Buffer for scheduled posts. Then hire roles that use those connections so runs produce real artifacts — not dead-end chat.",
        ],
      },
    ],
  },
  {
    slug: "ai-agent-vs-ai-employee",
    title: "AI agent vs AI employee: what’s the difference?",
    description:
      "AI agent is the technical idea; AI employee is the product framing — role, tools, approvals, and repeatable work. See how the terms relate and how Nexa uses both.",
    date: "2026-10-15",
    keywords: ["AI agent", "AI agents", "AI employee", "AI team", "Nexa"],
    sections: [
      {
        paragraphs: [
          "An AI agent is software that can plan steps and use tools toward a goal. An AI employee is how product teams present that idea for business users: hire someone for a role, connect accounts, run work on a schedule, and review results.",
        ],
      },
      {
        heading: "Why the wording matters",
        paragraphs: [
          "Searchers looking for “AI agent” often want frameworks and APIs. Searchers looking for “AI employee” or “AI team” often want something they can run without building infrastructure. Nexa targets the second group while still using real agent workflows under the hood.",
        ],
      },
      {
        heading: "What to look for in a platform",
        paragraphs: [
          "Clear roles, live connections (not mock buttons), approval for risky actions, and a work history. Those features turn an AI agent demo into an AI employee you can trust day to day.",
        ],
      },
    ],
  },
  {
    slug: "hire-ai-employees-for-startups",
    title: "Hire AI employees for your startup without hiring headcount",
    description:
      "Startups use AI employees to cover research, content, and light ops before they can hire full-time staff. Learn a practical setup with Nexa’s Free and Pro plans.",
    date: "2026-10-15",
    keywords: ["hire AI employees", "AI employees", "AI team", "startup automation", "Nexa"],
    sections: [
      {
        paragraphs: [
          "Early startups need leverage more than headcount. Hiring AI employees lets a founder cover recurring tasks — competitive notes in Notion, draft posts, CRM tagging — while staying in the loop for approval.",
        ],
      },
      {
        heading: "A simple first week",
        paragraphs: [
          "Day 1: connect one tool you already use. Day 2: hire one AI employee with a narrow role. Day 3: run work once, approve or edit the output, then schedule a repeat if it worked.",
          "On Nexa Free you can hire up to three AI employees and three connections. When the AI team is useful every day, Pro raises limits for employees, runs, and Vault storage.",
        ],
      },
      {
        heading: "Keep humans in charge",
        paragraphs: [
          "Good AI teams do not replace judgment. They draft, fetch, organize, and queue actions. You still decide what goes public and what touches customer data. That balance is the point of an AI employee platform.",
        ],
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function allSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}
