import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { deleteConnection } from "@/lib/connectors/tokenStore";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req);
    if ("error" in auth) return auth.error;
    await deleteConnection(auth.userId, "hubspot");
    return NextResponse.json({
      ok: true,
      message: "Your HubSpot account was disconnected.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not disconnect." },
      { status: 500 }
    );
  }
}
