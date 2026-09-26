import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/connectors/tokenStore";
import {
  notionAppendBlocks,
  notionCreatePage,
  notionSearch,
} from "@/lib/connectors/providers/notion";

/**
 * Execute a Notion action for the authenticated Nexa user.
 * Tokens never returned to the client.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const actionId = String(body.actionId || "").trim();
    const input = (body.input || {}) as Record<string, string>;

    if (!userId || !actionId) {
      return NextResponse.json(
        { ok: false, message: "userId and actionId required" },
        { status: 400 }
      );
    }

    const conn = await getConnection(userId, "notion");
    if (!conn?.accessToken) {
      return NextResponse.json({
        ok: false,
        message: "Notion is not connected. Connect it under Connections first.",
      });
    }

    let result;
    switch (actionId) {
      case "notion.create_page":
        result = await notionCreatePage({
          accessToken: conn.accessToken,
          parentId: input.parent_id || "",
          title: input.title || "",
          content: input.content,
        });
        break;
      case "notion.append_blocks":
        result = await notionAppendBlocks({
          accessToken: conn.accessToken,
          pageId: input.page_id || "",
          content: input.content || "",
        });
        break;
      case "notion.search":
        result = await notionSearch({
          accessToken: conn.accessToken,
          query: input.query || "",
        });
        break;
      default:
        return NextResponse.json({
          ok: false,
          message: `Unknown or unsupported Notion action: ${actionId}`,
        });
    }

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      data: result.data,
      error: result.error,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Execution failed" }, { status: 500 });
  }
}
