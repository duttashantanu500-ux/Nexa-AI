import { NextRequest, NextResponse } from "next/server";
import { completeAgentBuilder } from "@/lib/agentBuilder/complete";
import { validateProposal } from "@/lib/agentBuilder/validate";

const STATUS_PROVIDERS = [
  "notion",
  "slack",
  "buffer",
  "hubspot",
  "ideogram",
  "mcp",
] as const;

async function loadConnectionMap(
  userId: string,
  origin: string
): Promise<Record<string, string>> {
  if (!userId) return {};
  const out: Record<string, string> = {};
  await Promise.all(
    STATUS_PROVIDERS.map(async (p) => {
      try {
        const res = await fetch(
          `${origin}/api/connections/${p}/status?userId=${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        out[p] = String(data.status || "available");
      } catch {
        out[p] = "available";
      }
    })
  );
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userId = String(body.userId || "").trim();
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

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`
        : req.nextUrl.origin);

    const connections = await loadConnectionMap(userId, origin);
    const result = await completeAgentBuilder({
      messages: cleaned,
      connections,
    });

    if (result.kind === "off_topic") {
      return NextResponse.json({
        ok: true,
        declined: true,
        message: result.message,
        proposal: null,
        thinking: result.thinking || [],
      });
    }

    if (result.kind === "error") {
      return NextResponse.json({
        ok: false,
        declined: false,
        message: result.message,
        proposal: null,
        thinking: result.thinking || [],
      });
    }

    const validated = validateProposal(result.proposal, connections);
    const connectorNotes = validated.requiredConnectors
      .filter((c) => c.status !== "connected")
      .map((c) =>
        c.status === "coming_soon"
          ? `${c.name} is coming soon`
          : `${c.name} is not connected yet — connect it under Connections`
      );

    let message = result.message;
    if (connectorNotes.length) {
      message += `\n\nConnectors needed:\n• ${connectorNotes.join("\n• ")}`;
    }
    if (validated.issues.filter((i) => i.severity === "warning").length) {
      const warns = validated.issues
        .filter((i) => i.severity === "warning")
        .map((i) => i.message)
        .slice(0, 4);
      if (warns.length) {
        message += `\n\nBefore this employee can run fully:\n• ${warns.join("\n• ")}`;
      }
    }

    return NextResponse.json({
      ok: true,
      declined: false,
      message,
      proposal: validated.canDraft ? validated.proposal : null,
      validation: {
        canActivate: validated.canActivate,
        canDraft: validated.canDraft,
        issues: validated.issues,
        requiredConnectors: validated.requiredConnectors,
        approvalSteps: validated.approvalSteps,
      },
      thinking: result.thinking || [],
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
