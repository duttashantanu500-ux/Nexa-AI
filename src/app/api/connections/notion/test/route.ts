import { NextRequest, NextResponse } from "next/server";
import { getConnection, touchVerified } from "@/lib/connectors/tokenStore";
import { notionVerifyToken } from "@/lib/connectors/providers/notion";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, message: "userId required" }, { status: 400 });
    }
    const conn = await getConnection(userId, "notion");
    if (!conn) {
      return NextResponse.json({
        ok: false,
        message: "Notion is not connected for this user.",
      });
    }
    const verify = await notionVerifyToken(conn.accessToken);
    if (verify.ok) await touchVerified(userId, "notion");
    return NextResponse.json({
      ok: verify.ok,
      message: verify.message,
      data: verify.data,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Test failed" }, { status: 500 });
  }
}
