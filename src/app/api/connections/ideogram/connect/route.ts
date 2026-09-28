import { NextRequest, NextResponse } from "next/server";
import { ideogramVerifyKey } from "@/lib/connectors/providers/ideogram";
import { saveIdeogramKey } from "@/lib/connectors/ideogramAuth";

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
        { ok: false, message: "Paste your Ideogram access key to continue." },
        { status: 400 }
      );
    }

    const verify = await ideogramVerifyKey(apiKey);
    if (!verify.ok) {
      return NextResponse.json({
        ok: false,
        message: verify.message || "Could not verify this Ideogram access key.",
      });
    }

    const saved = await saveIdeogramKey(userId, apiKey);
    if (!saved.ok) {
      return NextResponse.json({
        ok: false,
        message: saved.message || "Could not save your connection.",
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Your Ideogram account is connected.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
