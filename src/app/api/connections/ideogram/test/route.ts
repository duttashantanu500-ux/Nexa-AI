import { NextRequest, NextResponse } from "next/server";
import { touchVerified } from "@/lib/connectors/tokenStore";
import { ideogramVerifyKey } from "@/lib/connectors/providers/ideogram";
import { resolveIdeogramToken } from "@/lib/connectors/ideogramAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 400 });
    }

    const resolved = await resolveIdeogramToken(userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message: "Connect your Ideogram account first.",
      });
    }

    const verify = await ideogramVerifyKey(resolved.token);
    if (verify.ok) await touchVerified(userId, "ideogram");

    return NextResponse.json({
      ok: verify.ok,
      message: verify.ok
        ? "Success — Nexa can use your Ideogram account."
        : verify.message || "Could not reach Ideogram.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
