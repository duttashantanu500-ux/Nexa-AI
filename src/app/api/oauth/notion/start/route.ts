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
    const clientId = process.env.NOTION_CLIENT_ID?.trim();
    if (!clientId) {
      return NextResponse.json(
        {
          error:
            "Notion is not configured. Set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET in Vercel.",
        },
        { status: 503 }
      );
    }

    const userId = req.nextUrl.searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json(
        {
          error:
            "Missing userId. Open Connect from the Notion details page while signed in.",
        },
        { status: 400 }
      );
    }

    try {
      const { assertCanAddConnection } = await import("@/lib/serverPlanGate");
      const gate = await assertCanAddConnection(userId, "notion");
      if (!gate.ok) {
        return NextResponse.json(
          { error: gate.message, limitReached: true },
          { status: 403 }
        );
      }
    } catch (gateErr) {
      console.error("[oauth/notion/start] plan gate", gateErr);
    }

    const redirect = `${appOrigin()}/api/oauth/notion/callback`;
    const state = signOAuthState(userId);
    const url = `https://api.notion.com/v1/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(
      redirect
    )}&state=${encodeURIComponent(state)}`;

    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[oauth/notion/start]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not start Notion connection. Try again.",
      },
      { status: 500 }
    );
  }
}
