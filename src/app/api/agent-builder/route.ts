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
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content.slice(0, 8000),
      }));

    if (!cleaned.length) {
      return NextResponse.json(
        { ok: false, message: "Send a message to continue." },
        { status: 400 }
      );
    }

    const result = await completeAgentBuilder({ messages: cleaned });

    if (result.proposal) {
      const validated = validateProposal(result.proposal);
      return NextResponse.json({
        ok: result.ok,
        message: result.message,
        declined: result.declined,
        proposal: validated.ok ? validated.proposal : null,
        validationIssues: validated.ok ? [] : validated.issues,
      });
    }

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      declined: result.declined,
      proposal: null,
    });
  } catch (err) {
    console.error("[api/agent-builder]", err);
    return NextResponse.json(
      {
        ok: false,
        message: "AI Employee Builder failed. Try again.",
      },
      { status: 500 }
    );
  }
}
