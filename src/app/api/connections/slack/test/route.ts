import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { touchVerified } from "@/lib/connectors/tokenStore";
import { slackVerifyToken } from "@/lib/connectors/providers/slack";
import { resolveSlackToken } from "@/lib/connectors/slackAuth";

export async function POST(req: NextRequest) {
  try {
    let userId = "";
    const auth = await requireAuthUser(req);
    if (!("error" in auth)) {
      userId = auth.userId;
    } else {
      const body = await req.json().catch(() => ({}));
      userId = String((body as { userId?: string }).userId || "").trim();
    }
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
    }

    const resolved = await resolveSlackToken(userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message: "Connect your Slack workspace first.",
      });
    }

    const verify = await slackVerifyToken(resolved.token);
    if (verify.ok) await touchVerified(userId, "slack");

    return NextResponse.json({
      ok: verify.ok,
      message: verify.ok
        ? "Success — Nexa can reach your Slack workspace."
        : verify.message || "Could not reach Slack.",
      data: verify.data,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
