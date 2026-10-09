import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { slackListChannels, slackPostMessage } from "@/lib/connectors/providers/slack";
import { resolveSlackToken } from "@/lib/connectors/slackAuth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const actionId = String((body as { actionId?: string }).actionId || "").trim();
    const input = ((body as { input?: Record<string, string> }).input || {}) as Record<
      string,
      string
    >;

    if (!actionId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 400 });
    }

    const userId = auth.userId;
    const resolved = await resolveSlackToken(userId);
    if (!resolved?.token) {
      return NextResponse.json({
        ok: false,
        message: "Connect your Slack workspace under Connections first.",
      });
    }

    let result;
    switch (actionId) {
      case "slack.post_message":
        result = await slackPostMessage({
          accessToken: resolved.token,
          channel: input.channel || "",
          text: input.text || "",
        });
        break;
      case "slack.list_channels":
        result = await slackListChannels({ accessToken: resolved.token });
        break;
      default:
        return NextResponse.json({
          ok: false,
          message: "This action is not available.",
        });
    }

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      data: result.data,
      error: result.error,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
