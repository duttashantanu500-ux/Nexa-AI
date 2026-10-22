import { NextRequest, NextResponse } from "next/server";
import { signOAuthState } from "@/lib/connectors/tokenStore";

function appOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "https://www.nexaiintelligence.online";
}

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.SLACK_CLIENT_ID?.trim();
    if (!clientId) {
      return NextResponse.json(
        { error: "Slack is not set up on this site yet. Add SLACK_CLIENT_ID in Vercel env." },
        { status: 503 }
      );
    }

    const userId = req.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json(
        { error: "Please sign in and try Connect again." },
        { status: 400 }
      );
    }

    try {
      const { assertCanAddConnection } = await import("@/lib/serverPlanGate");
      const gate = await assertCanAddConnection(userId, "slack");
      if (!gate.ok) {
        return NextResponse.json(
          { error: gate.message, limitReached: true },
          { status: 403 }
        );
      }
    } catch (gateErr) {
      console.error("[oauth/slack/start] plan gate", gateErr);
      // Do not block connect if billing check fails — prefer OAuth over hard 500
    }

    const redirect = `${appOrigin()}/api/oauth/slack/callback`;
    const state = signOAuthState(userId);
    const scopes = ["channels:read", "groups:read", "chat:write"].join(",");
    const url = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
      clientId
    )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
      redirect
    )}&state=${encodeURIComponent(state)}`;

    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[oauth/slack/start]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not start Slack connection. Try again.",
      },
      { status: 500 }
    );
  }
}
