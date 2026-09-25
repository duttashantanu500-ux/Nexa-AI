import { NextResponse } from "next/server";

/**
 * Reports which OAuth providers the deployment administrator has configured.
 * Does not expose secrets.
 */
export async function GET() {
  const slack = Boolean(
    process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
  );
  const notion = Boolean(
    process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET
  );
  const github = Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  );
  const google = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return NextResponse.json({
    providers: {
      slack: { configured: slack, connectPath: slack ? "/api/oauth/slack/start" : null },
      notion: { configured: notion, connectPath: notion ? "/api/oauth/notion/start" : null },
      github: { configured: github, connectPath: github ? "/api/oauth/github/start" : null },
      google: { configured: google, connectPath: google ? "/api/oauth/google/start" : null },
    },
  });
}
