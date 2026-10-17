import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { resolveVapiToken } from "@/lib/connectors/vapiAuth";
import { vapiVerifyKey } from "@/lib/connectors/providers/vapi";
import { touchVerified } from "@/lib/connectors/tokenStore";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ("error" in auth) return auth.error;

    const resolved = await resolveVapiToken(auth.userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message: "Connect your Vapi account under Connections first.",
      });
    }

    const verify = await vapiVerifyKey(resolved.token);
    if (verify.ok) {
      await touchVerified(auth.userId, "vapi");
    }
    return NextResponse.json({
      ok: verify.ok,
      message: verify.ok
        ? "Success — Nexa can reach your Vapi account."
        : verify.message || "Could not reach Vapi.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
