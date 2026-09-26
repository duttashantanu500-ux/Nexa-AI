import { NextRequest, NextResponse } from "next/server";
import { touchVerified } from "@/lib/connectors/tokenStore";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";
import { resolveNotionToken } from "@/lib/connectors/notionAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, message: "userId required" }, { status: 400 });
    }

    const resolved = await resolveNotionToken(userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message: "Notion is not connected for this user.",
      });
    }

    const verify = await notionVerifyToken(resolved.token);
    if (verify.ok && resolved.source === "oauth") {
      await touchVerified(userId, "notion");
    }

    return NextResponse.json({
      ok: verify.ok,
      message:
        verify.ok && resolved.source === "internal"
          ? "Internal Notion token works"
          : verify.message,
      data: verify.data,
      source: resolved.source,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Test failed" }, { status: 500 });
  }
}
