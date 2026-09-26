import { NextRequest, NextResponse } from "next/server";
import {
  notionAppendBlocks,
  notionCreatePage,
  notionSearch,
} from "@/lib/connectors/providers/notion";
import { resolveNotionToken } from "@/lib/connectors/notionAuth";
import { extractNotionPageId, formatNotionPageId } from "@/lib/connectors/notionParent";

async function resolveParentId(
  token: string,
  input: Record<string, string>,
  defaultParent?: string
): Promise<{ ok: true; parentId: string } | { ok: false; message: string }> {
  const direct =
    extractNotionPageId(input.parent_id || "") ||
    extractNotionPageId(input.parent_url || "") ||
    extractNotionPageId(defaultParent || "");

  if (direct) {
    return { ok: true, parentId: formatNotionPageId(direct) };
  }

  const name = (input.parent_name || input.parent || "").trim();
  if (name) {
    const search = await notionSearch({ accessToken: token, query: name });
    if (!search.ok) {
      return { ok: false, message: search.message || "Could not search Notion." };
    }
    const pages = (search.data as { pages?: { id: string; title?: string }[] })?.pages || [];
    const match =
      pages.find((p) => (p.title || "").toLowerCase() === name.toLowerCase()) || pages[0];
    if (match?.id) {
      return { ok: true, parentId: match.id };
    }
    return {
      ok: false,
      message: `No page found named "${name}". Share it with Nexa in Notion, or set a default page in Connections.`,
    };
  }

  return {
    ok: false,
    message:
      "Set a default page once in Connections → Notion, or name a parent page.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const actionId = String(body.actionId || "").trim();
    const input = (body.input || {}) as Record<string, string>;
    const defaultParent = String(body.defaultParent || "").trim();

    if (!userId || !actionId) {
      return NextResponse.json(
        { ok: false, message: "Sign in required." },
        { status: 400 }
      );
    }

    // Only this user's Notion — never a shared admin token
    const resolved = await resolveNotionToken(userId);
    if (!resolved?.token) {
      return NextResponse.json({
        ok: false,
        message: "Connect your own Notion account under Connections first.",
      });
    }

    let result;
    switch (actionId) {
      case "notion.create_page": {
        const parent = await resolveParentId(resolved.token, input, defaultParent);
        if (!parent.ok) {
          return NextResponse.json({ ok: false, message: parent.message });
        }
        result = await notionCreatePage({
          accessToken: resolved.token,
          parentId: parent.parentId,
          title: input.title || "Untitled",
          content: input.content,
        });
        break;
      }
      case "notion.append_blocks": {
        const pageId =
          extractNotionPageId(input.page_id || "") ||
          extractNotionPageId(input.page_url || "");
        let target = pageId ? formatNotionPageId(pageId) : "";
        if (!target && (input.page_name || input.page || "").trim()) {
          const search = await notionSearch({
            accessToken: resolved.token,
            query: (input.page_name || input.page || "").trim(),
          });
          const pages = (search.data as { pages?: { id: string }[] })?.pages || [];
          if (pages[0]?.id) target = pages[0].id;
        }
        result = await notionAppendBlocks({
          accessToken: resolved.token,
          pageId: target,
          content: input.content || "",
        });
        break;
      }
      case "notion.search":
        result = await notionSearch({
          accessToken: resolved.token,
          query: input.query || input.title || "",
        });
        break;
      default:
        return NextResponse.json({
          ok: false,
          message: `Unknown action: ${actionId}`,
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
