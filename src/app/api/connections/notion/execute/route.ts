import { NextRequest, NextResponse } from "next/server";
import {
  notionAppendBlocks,
  notionCreatePage,
  notionSearch,
} from "@/lib/connectors/providers/notion";
import { resolveNotionToken } from "@/lib/connectors/notionAuth";

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

    const resolved = await resolveNotionToken(userId);
    if (!resolved?.token) {
      return NextResponse.json({
        ok: false,
        message:
          "Notion is not connected. Set NOTION_INTERNAL_TOKEN in Vercel or complete OAuth.",
      });
    }

    let result;
    switch (actionId) {
      case "notion.create_page":
        result = await notionCreatePage({
          accessToken: resolved.token,
          parentId: input.parent_id || "",
          title: input.title || "",
          content: input.content,
        });
        break;
      case "notion.append_blocks":
        result = await notionAppendBlocks({
          accessToken: resolved.token,
          pageId: input.page_id || "",
          content: input.content || "",
        });
        break;
      case "notion.search":
        result = await notionSearch({
          accessToken: resolved.token,
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
