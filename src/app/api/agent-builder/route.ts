import { NextRequest, NextResponse } from "next/server";
import { completeAgentBuilder } from "@/lib/agentBuilder/complete";
import { validateProposal } from "@/lib/agentBuilder/validate";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const cleaned = messages
      .filter(
        (m: { role?: string; content?: string }) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim()
      )
      .slice(-12)
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content.slice(0, 4000),
      }));

    if (!cleaned.length) {
      return NextResponse.json(
        { ok: false, error: "empty_messages" },
        { status: 400 }
      );
    }

    const result = await completeAgentBuilder({ messages: cleaned });

    if (result.kind === "off_topic") {
      return NextResponse.json({
        ok: true,
        kind: "off_topic",
        message: result.message,
      });
    }

    if (result.kind === "error") {
      return NextResponse.json({
        ok: false,
        kind: "error",
        message: result.message,
      });
    }

    const validated = validateProposal(result.proposal);

    return NextResponse.json({
      ok: true,
      kind: "proposal",
      message: result.message,
      provider: result.provider,
      validated,
    });
  } catch (err: unknown) {
    console.error("[api/agent-builder]", err);
    return NextResponse.json(
      {
        ok: false,
        kind: "error",
        message: "Agent Builder failed. Try again.",
      },
      { status: 500 }
    );
  }
}
