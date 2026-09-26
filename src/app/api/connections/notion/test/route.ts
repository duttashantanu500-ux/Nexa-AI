import { NextRequest, NextResponse } from "next/server";
import { touchVerified } from "@/lib/connectors/tokenStore";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";
import { resolveNotionToken } from "@/lib/connectors/notionAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 400 });
    }

    const resolved = await resolveNotionToken(userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message: "Connect your own Notion account first.",
      });
    }

    const verify = await notionVerifyToken(resolved.token);
    if (verify.ok) await touchVerified(userId, "notion");

    return NextResponse.json({
      ok: verify.ok,
      message: verify.ok
        ? "Success — using your Notion account."
        : verify.message || "Could not reach Notion.",
      data: verify.data,
      source: "oauth",
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Test failed." }, { status: 500 });
  }
}
