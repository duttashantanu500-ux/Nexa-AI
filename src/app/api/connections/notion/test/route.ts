import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { touchVerified } from "@/lib/connectors/tokenStore";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";
import { resolveNotionToken } from "@/lib/connectors/notionAuth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ("error" in auth) return auth.error;
    const userId = auth.userId;

    const resolved = await resolveNotionToken(userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message: "Connect your Notion account first.",
      });
    }

    const verify = await notionVerifyToken(resolved.token);
    if (verify.ok) await touchVerified(userId, "notion");

    return NextResponse.json({
      ok: verify.ok,
      message: verify.ok
        ? "Success — Nexa can reach your Notion workspace."
        : verify.message || "Could not reach Notion.",
      data: verify.data,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
