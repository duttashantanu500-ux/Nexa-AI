import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { removeIdeogramConnection } from "@/lib/connectors/ideogramAuth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ("error" in auth) return auth.error;
    await removeIdeogramConnection(auth.userId);
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
