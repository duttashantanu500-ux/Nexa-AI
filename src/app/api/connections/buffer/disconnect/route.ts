import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { deleteConnection } from "@/lib/connectors/tokenStore";

export async function POST(req: NextRequest) {
  try {
    let userId = "";
    const auth = await requireAuthUser(req);
    if (!("error" in auth)) {
      userId = auth.userId;
    } else {
      const body = await req.json().catch(() => ({}));
      userId = String((body as { userId?: string }).userId || "").trim();
    }
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
    }
    await deleteConnection(userId, "buffer");
    return NextResponse.json({
      ok: true,
      message: "Your Buffer account was disconnected.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not disconnect." },
      { status: 500 }
    );
  }
}
