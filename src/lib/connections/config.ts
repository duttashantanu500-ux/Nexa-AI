/**
 * Server-side detection of which integrations are actually configurable.
 * Never report Connected without real auth success.
 */

export type ProviderId =
  | "gmail"
  | "gdrive"
  | "gcal"
  | "slack"
  | "notion"
  | "github"
  | "shopify"
  | "airtable"
  | "mcp";

export interface ProviderConfigStatus {
  provider: ProviderId;
  name: string;
  configured: boolean;
  missingEnv: string[];
  setupHint: string;
  oauthSupported: boolean;
}

export function getProviderStatuses(): ProviderConfigStatus[] {
  const googleId = process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleOk = Boolean(googleId && googleSecret);

  const slackId = process.env.SLACK_CLIENT_ID;
  const slackSecret = process.env.SLACK_CLIENT_SECRET;
  const slackOk = Boolean(slackId && slackSecret);

  return [
    {
      provider: "gmail",
      name: "Gmail",
      configured: googleOk,
      missingEnv: [
        ...(!googleId ? ["GOOGLE_CLIENT_ID"] : []),
        ...(!googleSecret ? ["GOOGLE_CLIENT_SECRET"] : []),
      ],
      setupHint:
        "Create a Google Cloud OAuth client (Web) with Gmail scopes, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Vercel, redeploy.",
      oauthSupported: true,
    },
    {
      provider: "gdrive",
      name: "Google Drive",
      configured: googleOk,
      missingEnv: [
        ...(!googleId ? ["GOOGLE_CLIENT_ID"] : []),
        ...(!googleSecret ? ["GOOGLE_CLIENT_SECRET"] : []),
      ],
      setupHint:
        "Same Google OAuth client as Gmail; enable Drive API and Drive scopes.",
      oauthSupported: true,
    },
    {
      provider: "gcal",
      name: "Google Calendar",
      configured: googleOk,
      missingEnv: [
        ...(!googleId ? ["GOOGLE_CLIENT_ID"] : []),
        ...(!googleSecret ? ["GOOGLE_CLIENT_SECRET"] : []),
      ],
      setupHint: "Same Google OAuth client; enable Calendar API.",
      oauthSupported: true,
    },
    {
      provider: "slack",
      name: "Slack",
      configured: slackOk,
      missingEnv: [
        ...(!slackId ? ["SLACK_CLIENT_ID"] : []),
        ...(!slackSecret ? ["SLACK_CLIENT_SECRET"] : []),
      ],
      setupHint:
        "Create a Slack app OAuth, set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET, redeploy.",
      oauthSupported: true,
    },
    {
      provider: "notion",
      name: "Notion",
      configured: Boolean(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET),
      missingEnv: [
        ...(!process.env.NOTION_CLIENT_ID ? ["NOTION_CLIENT_ID"] : []),
        ...(!process.env.NOTION_CLIENT_SECRET ? ["NOTION_CLIENT_SECRET"] : []),
      ],
      setupHint: "Notion OAuth not fully wired yet. Env keys reserved.",
      oauthSupported: false,
    },
    {
      provider: "github",
      name: "GitHub",
      configured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      missingEnv: [
        ...(!process.env.GITHUB_CLIENT_ID ? ["GITHUB_CLIENT_ID"] : []),
        ...(!process.env.GITHUB_CLIENT_SECRET ? ["GITHUB_CLIENT_SECRET"] : []),
      ],
      setupHint: "GitHub OAuth app env reserved; flow not fully wired yet.",
      oauthSupported: false,
    },
    {
      provider: "shopify",
      name: "Shopify",
      configured: false,
      missingEnv: ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"],
      setupHint: "Not implemented yet.",
      oauthSupported: false,
    },
    {
      provider: "airtable",
      name: "Airtable",
      configured: false,
      missingEnv: ["AIRTABLE_CLIENT_ID"],
      setupHint: "Not implemented yet.",
      oauthSupported: false,
    },
  ];
}
