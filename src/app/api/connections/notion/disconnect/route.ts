import { NextRequest, NextResponse } from "next/server";
import { deleteConnection } from "@/lib/connectors/tokenStore";
import { resolveNotionToken } from "@/lib/connectors/notionAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 400 });
    }

    const resolved = await resolveNotionToken(userId);
    if (resolved?.source === "internal") {
      return NextResponse.json({
        ok: false,
        message:
          "This site uses a workspace key set by the admin. To turn Notion off, remove NOTION_INTERNAL_TOKEN in Vercel and redeploy.",
      });
    }

    await deleteConnection(userId, "notion");
    return NextResponse.json({ ok: true, message: "Notion disconnected." });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not disconnect." }, { status: 500 });
  }
}
