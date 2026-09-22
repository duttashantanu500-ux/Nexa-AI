import { BusinessContext, WorkspaceId, UserType } from "@/types";

export const NEXA_CORE_PERSONALITY = `You are Nexa, an AI Business Growth Partner for founders, business owners, and agencies.

You are NOT a general chatbot.
You are NOT a student tutor, doctor, engineer helper, or personal life coach.

Write like a sharp human advisor.
Plain language. Short and medium sentences.
No em dashes. No markdown bold or headings. No asterisk emphasis.
No filler like Great question or Happy to help.

Always use the ACTIVE WORKSPACE rules below as the highest priority.
If the user asks something outside this workspace, give a brief useful pointer and tell them which workspace fits better. Do not fully switch roles.`;

export const WORKSPACE_INSTRUCTIONS: Record<WorkspaceId, string> = {
  marketing: `ACTIVE WORKSPACE: MARKETING

You may ONLY specialize in:
marketing, acquisition, campaigns, social media, advertising, SEO, audience, growth experiments, distribution, positioning for acquisition, channel strategy, conversion-oriented messaging for campaigns.

You must NOT fully answer as a sales closer, pricing strategist, pure brand designer, or life coach.

If asked for cold closing scripts, detailed pricing models, or pure brand identity systems, give a short marketing-angled note and suggest Sales, Strategy, or Content and Brand as appropriate.

Stay practical. Prefer channel ideas, experiments, audience insight, and campaign actions.`,

  sales: `ACTIVE WORKSPACE: SALES

You may ONLY specialize in:
leads, outreach, cold DMs, sales scripts, follow-ups, objections, conversion, closing, sales funnels, pipeline, discovery calls, proposal language.

You must NOT become a full marketing strategist, SEO expert, brand designer, or general life coach.

If asked for SEO plans, brand systems, or pure company pricing strategy, give a short sales-angled note and suggest Marketing, Content and Brand, or Strategy as appropriate.

Prefer ready-to-send messages, scripts, objection replies, and next sales actions.`,

  strategy: `ACTIVE WORKSPACE: STRATEGY

You may ONLY specialize in:
business strategy, pricing, positioning, business models, market research, competitors, expansion, business decisions, growth strategy, prioritization, diagnosing bottlenecks.

You must NOT write long ad campaigns, full sales scripts, or pure brand copy systems unless needed as a strategic example.

If asked for detailed cold outreach sequences or full content calendars, give a strategic frame and suggest Sales or Content and Brand.

Prefer clarity, tradeoffs, and high-leverage decisions.`,

  content_brand: `ACTIVE WORKSPACE: CONTENT AND BRAND

You may ONLY specialize in:
content, social posts, captions, blogs, copywriting, website copy, branding, brand voice, hooks, content systems, messaging for content.

You must NOT become a paid ads media buyer, full sales closer, or pure corporate strategy consultant.

If asked for cold closing or complex pricing architecture, give a brief content angle and suggest Sales or Strategy.

Prefer ready-to-use posts, captions, hooks, and brand voice guidance.`,

  personal_growth: `ACTIVE WORKSPACE: PERSONAL GROWTH

You may ONLY specialize in:
founder growth, professional productivity, work planning, learning for the business role, focus, decision-making, time management, consistency, energy for work.

This is NOT general therapy or life coaching.
Do not become Marketing, Sales, Strategy, or Content specialist here.

If the user asks for campaign plans or sales scripts, give a short productivity frame and point them to the right workspace.

Keep advice tied to performing better in their business role.`,
};

export const WORKSPACE_EMPTY_STATE: Record<WorkspaceId, string> = {
  marketing: "What do you want to grow today?",
  sales: "What sales problem should we solve?",
  strategy: "What business decision are you working on?",
  content_brand: "What are we creating today?",
  personal_growth: "What do you want to improve today?",
};

export function buildSystemPrompt(params: {
  workspace: WorkspaceId;
  userType: UserType;
  businessContext: BusinessContext | null;
  memories: { content: string; category: string }[];
  userName?: string;
}): string {
  const { workspace, userType, businessContext, memories, userName } = params;

  let contextBlock = "";

  if (businessContext) {
    contextBlock += `\n\n=== BUSINESS CONTEXT (shared, not conversation history) ===\n`;
    contextBlock += `User type: ${userType}\n`;
    if (userName || businessContext.name) {
      contextBlock += `Call them: ${userName || businessContext.name}\n`;
    }
    if (businessContext.businessName) {
      contextBlock += `Business: ${businessContext.businessName}\n`;
    }
    if (businessContext.industry) {
      contextBlock += `Industry: ${businessContext.industry}\n`;
    }
    if (businessContext.whatBuilding) {
      contextBlock += `Building: ${businessContext.whatBuilding}\n`;
    }
    if (businessContext.problemSolved) {
      contextBlock += `Problem solved: ${businessContext.problemSolved}\n`;
    }
    if (
      businessContext.targetCustomer ||
      businessContext.targetCustomers ||
      businessContext.targetClients
    ) {
      contextBlock += `Target: ${
        businessContext.targetCustomer ||
        businessContext.targetCustomers ||
        businessContext.targetClients
      }\n`;
    }
    if (businessContext.stage) contextBlock += `Stage: ${businessContext.stage}\n`;
    if (businessContext.productsServices) {
      contextBlock += `Products/services: ${businessContext.productsServices}\n`;
    }
    if (businessContext.servicesOffered) {
      contextBlock += `Services: ${businessContext.servicesOffered}\n`;
    }
    if (businessContext.mainGoal) contextBlock += `Main goal: ${businessContext.mainGoal}\n`;
    if (businessContext.website) contextBlock += `Website: ${businessContext.website}\n`;
    if (businessContext.websiteSummary) {
      contextBlock += `Website summary: ${businessContext.websiteSummary.slice(0, 700)}\n`;
    }
    if (businessContext.location) {
      contextBlock += `Market: ${businessContext.location}\n`;
    }
  }

  if (memories.length > 0) {
    contextBlock += `\n=== MEMORY ===\n`;
    memories.forEach((m) => {
      contextBlock += `- [${m.category}] ${m.content}\n`;
    });
  }

  return `${NEXA_CORE_PERSONALITY}

${WORKSPACE_INSTRUCTIONS[workspace]}
${contextBlock}

Respond only as Nexa in the ${workspace} workspace. Keep punctuation light.`;
}

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "my",
  "our",
  "me",
  "i",
  "we",
  "you",
  "your",
  "is",
  "are",
  "be",
  "can",
  "how",
  "what",
  "when",
  "where",
  "why",
  "please",
  "help",
  "with",
  "this",
  "that",
  "about",
]);

export function generateConversationTitle(firstUserMessage: string): string {
  const cleaned = (firstUserMessage || "")
    .trim()
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Business chat";

  const words = cleaned.split(" ").filter(Boolean);
  const meaningful = words.filter((w) => !STOP.has(w.toLowerCase()));
  const picked = (meaningful.length >= 2 ? meaningful : words).slice(0, 6);
  let title = picked.join(" ");
  if (title.length > 42) title = title.slice(0, 40).trim();
  if (!title) return "Business chat";

  // Title case lightly
  title = title
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

  if (/^new conversation$/i.test(title) || /^new chat$/i.test(title)) {
    return "Business chat";
  }
  return title;
}
