import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { touchVerified } from "@/lib/connectors/tokenStore";
import { ideogramVerifyKey } from "@/lib/connectors/providers/ideogram";
import { resolveIdeogramToken } from "@/lib/connectors/ideogramAuth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ("error" in auth) return auth.error;
    const userId = auth.userId;

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
