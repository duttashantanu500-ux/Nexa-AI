import { NextRequest, NextResponse } from "next/server";
import { removeIdeogramConnection } from "@/lib/connectors/ideogramAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 400 });
    }
    await removeIdeogramConnection(userId);
    return NextResponse.json({
      ok: true,
      message: "Ideogram disconnected.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not disconnect." },
      { status: 500 }
    );
  }
}
