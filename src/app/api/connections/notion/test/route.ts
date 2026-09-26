import { NextRequest, NextResponse } from "next/server";
import { touchVerified } from "@/lib/connectors/tokenStore";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";
import { resolveNotionToken } from "@/lib/connectors/notionAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 400 });
    }

    const resolved = await resolveNotionToken(userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message: "Notion is not linked yet.",
      });
    }

    const verify = await notionVerifyToken(resolved.token);
    if (verify.ok && resolved.source === "oauth") {
      await touchVerified(userId, "notion");
    }

    return NextResponse.json({
      ok: verify.ok,
      message: verify.ok
        ? "Success — Nexa can reach your Notion workspace."
        : verify.message || "Could not reach Notion.",
      data: verify.data,
      source: resolved.source,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Test failed. Try again." }, { status: 500 });
  }
}
