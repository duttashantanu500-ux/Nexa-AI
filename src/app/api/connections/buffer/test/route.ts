import { NextRequest, NextResponse } from "next/server";
import { touchVerified } from "@/lib/connectors/tokenStore";
import { bufferVerifyToken } from "@/lib/connectors/providers/buffer";
import { resolveBufferToken } from "@/lib/connectors/bufferAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 400 });
    }

    const resolved = await resolveBufferToken(userId);
    if (!resolved) {
      return NextResponse.json({
        ok: false,
        message:
          "Buffer is not connected or the saved login expired. Connect Buffer under Connections, then try again.",
        cleared: true,
      });
    }

    const verify = await bufferVerifyToken(resolved.token);
    if (verify.ok) await touchVerified(userId, "buffer");

    return NextResponse.json({
      ok: verify.ok,
      message: verify.ok
        ? "Success — Nexa can reach your Buffer account."
        : verify.message || "Could not reach Buffer.",
      data: verify.data,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
