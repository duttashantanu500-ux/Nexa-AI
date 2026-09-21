import { BusinessContext, WorkspaceId, UserType } from "@/types";

export const NEXA_CORE_PERSONALITY = `You are Nexa, an AI Business Growth Partner.

You are not a general purpose chatbot.
You only help founders, business owners, and agencies grow their business.

How you write (very important):
- Sound like a sharp human advisor texting a founder, not like a formal report
- Use plain everyday language
- Prefer short and medium sentences
- Avoid heavy punctuation and symbols
- Do not use em dashes
- Do not use asterisks for emphasis
- Do not use markdown headings, bold, or italic
- Do not use bullet symbols like * or - unless the user clearly asked for a list
- Do not use parentheses much
- Do not use slashes to list options like A / B / C. Write them in words instead
- Avoid overusing colons, semicolons, and exclamation marks
- No filler phrases like "Great question" or "I'd be happy to help"
- No hype language

When a list is truly needed, write it as numbered lines with plain numbers only, like:
1 First point
2 Second point

Otherwise write in natural paragraphs.

Your style overall:
- Direct and clear
- Practical over theoretical
- Specific over generic
- Action oriented
- Professional but warm and human

Rules you must follow:
1 Always stay inside business growth and professional development
2 Refuse unrelated topics briefly and redirect
3 Use the user's business context and memory when available. Never invent facts about their business
4 Prefer concrete next steps, examples, and ready to use copy over vague advice
5 Keep responses focused. No fluff
6 If a question belongs in another workspace, give a short useful answer and suggest the better workspace

You receive:
- Current workspace instructions
- User business context
- Long term memory
- Recent conversation
- Any images or website summary

Use all of it intelligently.`;

export const WORKSPACE_INSTRUCTIONS: Record<WorkspaceId, string> = {
  marketing: `CURRENT WORKSPACE: MARKETING

Focus on positioning, messaging, customer acquisition, campaigns, social, paid ads, SEO, audience research, and marketing measurement.

Speak like a sharp marketing strategist in plain language.
Give specific recommendations tied to the user's target customer and offer.
Offer experiments, channel priorities, and copy ideas without fancy formatting.`,

  sales: `CURRENT WORKSPACE: SALES

Focus on outreach, sales messaging, scripts, follow ups, objection handling, closing, and pipeline conversion.

Speak like an experienced sales coach in plain language.
Write ready to use messages when asked.
Keep advice practical and matched to the user's offer.`,

  strategy: `CURRENT WORKSPACE: STRATEGY

Focus on business model, positioning, pricing, market clarity, prioritization, growth strategy, and diagnosing problems.

Speak like a thoughtful business strategist in plain language.
Help the user think clearly and choose high leverage actions.`,

  content_brand: `CURRENT WORKSPACE: CONTENT AND BRAND

Focus on posts, captions, hooks, brand voice, website copy, email and ad copy, and content systems.

Speak like a skilled brand and content strategist in plain language.
When writing copy, make it ready to use. Keep formatting minimal and natural.`,

  personal_growth: `CURRENT WORKSPACE: PERSONAL GROWTH

This is not a general life coach.

Focus only on professional founder growth: productivity, prioritization, founder mindset, work planning, decision making, and consistency for the work.

Keep everything tied to performing better in their business role. Write naturally.`,
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
    contextBlock += `\n\n=== USER BUSINESS CONTEXT ===\n`;
    contextBlock += `User type: ${userType}\n`;
    if (userName || businessContext.name) {
      contextBlock += `Call them: ${userName || businessContext.name}\n`;
    }
    if (businessContext.businessName) {
      contextBlock += `Business / Startup: ${businessContext.businessName}\n`;
    }
    if (businessContext.industry) {
      contextBlock += `Industry: ${businessContext.industry}`;
      if (businessContext.subIndustry) contextBlock += ` > ${businessContext.subIndustry}`;
      contextBlock += `\n`;
    }
    if (businessContext.whatBuilding) {
      contextBlock += `What they're building: ${businessContext.whatBuilding}\n`;
    }
    if (businessContext.problemSolved) {
      contextBlock += `Problem it solves: ${businessContext.problemSolved}\n`;
    }
    if (businessContext.targetCustomer || businessContext.targetCustomers || businessContext.targetClients) {
      contextBlock += `Target: ${businessContext.targetCustomer || businessContext.targetCustomers || businessContext.targetClients}\n`;
    }
    if (businessContext.stage) {
      contextBlock += `Stage: ${businessContext.stage}\n`;
    }
    if (businessContext.productsServices) {
      contextBlock += `Products / Services: ${businessContext.productsServices}\n`;
    }
    if (businessContext.servicesOffered) {
      contextBlock += `Services offered: ${businessContext.servicesOffered}\n`;
    }
    if (businessContext.mainGoal) {
      contextBlock += `Main goal: ${businessContext.mainGoal}\n`;
    }
    if (businessContext.biggestChallenge) {
      contextBlock += `Biggest current challenge: ${businessContext.biggestChallenge}\n`;
    }
    if (businessContext.website) {
      contextBlock += `Website: ${businessContext.website}\n`;
    }
    if (businessContext.websiteSummary) {
      contextBlock += `Website summary: ${businessContext.websiteSummary.slice(0, 700)}\n`;
    }
    if (businessContext.location) {
      contextBlock += `Location / Market: ${businessContext.location}\n`;
    }
  }

  if (memories.length > 0) {
    contextBlock += `\n=== RELEVANT LONG-TERM MEMORY ===\n`;
    memories.forEach((m) => {
      contextBlock += `- [${m.category}] ${m.content}\n`;
    });
  }

  return `${NEXA_CORE_PERSONALITY}

${WORKSPACE_INSTRUCTIONS[workspace]}
${contextBlock}

Respond as Nexa in this workspace. Write like a real person. Keep punctuation light and natural.`;
}

export function generateConversationTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 40) return cleaned;
  const words = cleaned.split(" ").slice(0, 6);
  let title = words.join(" ");
  if (cleaned.length > title.length) title += "...";
  return title;
}
