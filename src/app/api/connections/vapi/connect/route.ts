import { NextRequest, NextResponse } from "next/server";
import { vapiVerifyKey } from "@/lib/connectors/providers/vapi";
import { saveVapiKey } from "@/lib/connectors/vapiAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const apiKey = String(body.apiKey || body.key || "").trim();

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "Please sign in first." },
        { status: 400 }
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, message: "Paste your Vapi private API key to continue." },
        { status: 400 }
      );
    }

    const verify = await vapiVerifyKey(apiKey);
    if (!verify.ok) {
      return NextResponse.json({
        ok: false,
        message: verify.message || "Could not verify this Vapi API key.",
      });
    }

    const saved = await saveVapiKey(userId, apiKey);
    if (!saved.ok) {
      return NextResponse.json({
        ok: false,
        message: saved.message || "Could not save your connection.",
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Your Vapi account is connected.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
