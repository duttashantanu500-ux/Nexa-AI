import { NextRequest, NextResponse } from "next/server";
import { deleteConnection } from "@/lib/connectors/tokenStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 400 });
    }

    await deleteConnection(userId, "notion");
    return NextResponse.json({
      ok: true,
      message: "Your Notion account was disconnected.",
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not disconnect." }, { status: 500 });
  }
}
