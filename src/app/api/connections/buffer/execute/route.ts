import { NextRequest, NextResponse } from "next/server";
import {
  bufferCreatePost,
  bufferListChannels,
  bufferListPosts,
} from "@/lib/connectors/providers/buffer";
import { resolveBufferToken } from "@/lib/connectors/bufferAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const actionId = String(body.actionId || "").trim();
    const input = (body.input || {}) as Record<string, string>;

    if (!userId || !actionId) {
      return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 400 });
    }

    const resolved = await resolveBufferToken(userId);
    if (!resolved?.token) {
      return NextResponse.json({
        ok: false,
        message:
          "Buffer is not connected or the saved login expired. Connect Buffer under Connections first.",
      });
    }

    let result;
    switch (actionId) {
      case "buffer.list_channels":
        result = await bufferListChannels({ accessToken: resolved.token });
        break;
      case "buffer.create_post":
        result = await bufferCreatePost({
          accessToken: resolved.token,
          channel: input.channel || "",
          text: input.text || "",
          scheduledAt: input.scheduled_at || input.scheduledAt || "",
        });
        break;
      case "buffer.list_posts":
        result = await bufferListPosts({
          accessToken: resolved.token,
          channel: input.channel || "",
        });
        break;
      default:
        return NextResponse.json({
          ok: false,
          message: "This action is not available.",
        });
    }

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      data: result.data,
      error: result.error,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
