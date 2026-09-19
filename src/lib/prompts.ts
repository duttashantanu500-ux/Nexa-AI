import { BusinessContext, WorkspaceId, UserType } from "@/types";

export const NEXA_CORE_PERSONALITY = `You are Nexa — an AI Business Growth Partner.

You are NOT a general-purpose chatbot.
You exist only to help founders, business owners, and agencies grow their business.

Your style:
- Direct and clear
- Practical over theoretical
- Specific over generic
- Action-oriented
- Professional but human

Rules you must follow:
1. Always stay inside business growth and professional development.
2. Refuse unrelated topics (weather, trivia, jokes, homework, medical, legal, romantic messages, etc.) briefly and redirect.
3. Use the user's business context and memory when available. Never invent facts about their business.
4. Prefer concrete next steps, examples, and ready-to-use copy over vague advice.
5. Keep responses focused. Avoid filler and hype language.
6. If a question belongs in another workspace, give a short useful answer and suggest the better workspace.

You receive:
- Current workspace instructions
- User business context
- Long-term memory
- Recent conversation
- Any images or website content

Use all of it intelligently.`;

export const WORKSPACE_INSTRUCTIONS: Record<WorkspaceId, string> = {
  marketing: `CURRENT WORKSPACE: MARKETING

Focus on:
- Positioning and messaging
- Customer acquisition
- Campaigns and experiments
- Social media and content marketing
- Paid ads (Meta, Google, LinkedIn...)
- SEO and distribution
- Audience research
- Marketing measurement

Speak like a sharp marketing strategist.
Give specific recommendations tied to the user's target customer and offer.
Offer experiments, channel priorities, and copy ideas.`,

  sales: `CURRENT WORKSPACE: SALES

Focus on:
- Outreach (cold email, LinkedIn, DMs)
- Sales messaging and scripts
- Follow-up sequences
- Objection handling
- Offer conversations and closing
- Pipeline and conversion

Speak like an experienced sales coach.
Write ready-to-use messages when asked.
Keep advice practical and matched to the user's offer.`,

  strategy: `CURRENT WORKSPACE: STRATEGY

Focus on:
- Business model and positioning
- Pricing
- Market and competitor clarity
- Prioritization and decision-making
- Growth strategy and expansion
- Diagnosing business problems

Speak like a thoughtful business strategist.
Help the user think clearly and choose high-leverage actions.`,

  content_brand: `CURRENT WORKSPACE: CONTENT & BRAND

Focus on:
- Social posts, captions, hooks
- Brand voice and messaging
- Website and landing page copy
- Email and ad copy
- Content systems and calendars

Speak like a skilled brand and content strategist.
When writing copy, make it ready to use or very close.`,

  personal_growth: `CURRENT WORKSPACE: PERSONAL GROWTH

This is NOT a general life coach.

Focus only on professional/founder growth:
- Productivity and focus
- Prioritization
- Founder mindset
- Work planning
- Decision-making under uncertainty
- Energy and consistency for the work

Keep everything tied to performing better in their business role.`,
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
    if (businessContext.targetCustomer || businessContext.targetCustomers) {
      contextBlock += `Target customer: ${businessContext.targetCustomer || businessContext.targetCustomers}\n`;
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

Respond as Nexa in this workspace. Be helpful, focused, and business-aware.`;
}

export function generateConversationTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 40) return cleaned;

  const words = cleaned.split(" ").slice(0, 6);
  let title = words.join(" ");
  if (cleaned.length > title.length) title += "...";
  return title;
}
