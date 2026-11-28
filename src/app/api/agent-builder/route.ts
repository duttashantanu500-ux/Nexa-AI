import { NextRequest, NextResponse } from "next/server";
import { completeAgentBuilder } from "@/lib/agentBuilder/complete";
import { validateProposal } from "@/lib/agentBuilder/validate";
import { loadLiveAccountOptions } from "@/lib/agentBuilder/liveAccountOptions";

/** Strip any residual internal model/provider noise before it reaches the UI. */
function sanitizePublicThinking(lines?: string[]): string[] {
  if (!Array.isArray(lines)) return [];
  const blocked =
    /\b(model\s*ok|model routes?|ollama|openrouter|openai|gpt-|gemini|groq|deepseek|api keys?|provider|nexa-local|local_fallback|composio)\b/i;
  return lines
    .map((s) => String(s || "").trim())
    .filter((s) => s.length > 0 && !blocked.test(s))
    .slice(0, 12);
}

function isActiveStatus(status: string): boolean {
  return /ACTIVE|CONNECTED|SUCCESS|ENABLED/i.test(String(status || ""));
}

/** Load connected app map from the live connections API (not legacy natives). */
async function loadConnectionMap(
  userId: string,
  origin: string
): Promise<Record<string, string>> {
  if (!userId) return {};
  const out: Record<string, string> = {};
  try {
    const res = await fetch(
      `${origin}/api/composio/connections?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    for (const a of accounts) {
      const slug = String(a.toolkit || a.app || a.slug || "")
        .toLowerCase()
        .trim();
      if (!slug) continue;
      if (isActiveStatus(String(a.status || ""))) {
        out[slug] = "connected";
      }
    }
  } catch {
    /* empty map */
  }
  return out;
}

function friendlyApp(slug: string): string {
  const map: Record<string, string> = {
    gmail: "Gmail",
    slack: "Slack",
    notion: "Notion",
    github: "GitHub",
    outlook: "Outlook",
    googledrive: "Google Drive",
    googlecalendar: "Google Calendar",
    googlesheets: "Google Sheets",
    discord: "Discord",
    linear: "Linear",
    asana: "Asana",
    trello: "Trello",
    jira: "Jira",
    buffer: "Buffer",
  };
  return map[slug] || slug.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    const mode = body.mode === "edit" ? "edit" : "create";
    const existingAgent =
      body.existingAgent && typeof body.existingAgent === "object"
        ? body.existingAgent
        : undefined;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const cleaned = messages
      .filter(
        (m: { role?: string; content?: string }) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim()
      )
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content.trim(),
      }))
      .slice(-12);

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
    let liveOptions = undefined;
    try {
      liveOptions = await loadLiveAccountOptions(userId);
    } catch (e) {
      console.warn("[api/agent-builder] live options", e);
    }
    const result = await completeAgentBuilder({
      messages: cleaned,
      connections,
      mode,
      existingAgent,
      liveOptions,
    });

    if (result.kind === "off_topic") {
      return NextResponse.json({
        ok: true,
        declined: true,
        message: result.message,
        proposal: null,
        thinking: sanitizePublicThinking(result.thinking),
      });
    }

    if (result.kind === "error") {
      return NextResponse.json({
        ok: false,
        declined: false,
        message: result.message,
        proposal: null,
        thinking: sanitizePublicThinking(result.thinking),
      });
    }

    const validated = validateProposal(result.proposal, connections);
    const connectorNotes = validated.requiredConnectors
      .filter((c) => c.status !== "connected")
      .map((c) => `${friendlyApp(c.id || c.name)} is not connected yet`);

    let message = String(result.message || "")
      .replace(/\bAI agent\b/gi, "AI employee")
      .replace(/\bagent\b/gi, "employee")
      .replace(/\bComposio\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (connectorNotes.length) {
      message += `\n\nApps needed:\n• ${connectorNotes.join("\n• ")}`;
    }

    if (connections.notion === "connected") {
      message = message.replace(
        /set a default page[^\n.]*/gi,
        "pick a Notion page from your workspace"
      );
    }

    if (validated.issues.filter((i) => i.severity === "warning").length) {
      const warns = validated.issues
        .filter((i) => i.severity === "warning")
        .map((i) => {
          let m = i.message;
          if (connections.notion === "connected" && /default page|parent page/i.test(m)) {
            m = "Notion is connected — pick a parent page or name it.";
          }
          if (connections.slack === "connected" && /channel/i.test(m)) {
            m = "Slack is connected — pick a channel.";
          }
          if (connections.buffer === "connected" && /channel|buffer/i.test(m)) {
            m = "Buffer is connected — pick a channel.";
          }
          return m
            .replace(/\bComposio\b/gi, "")
            .replace(/\bagent\b/gi, "employee");
        })
        .slice(0, 4);
      if (warns.length) {
        message += `\n\nBefore this employee can run fully:\n• ${warns.join("\n• ")}`;
      }
    }

    const connectedList = Object.keys(connections)
      .filter((k) => connections[k] === "connected")
      .map(friendlyApp);

    return NextResponse.json({
      ok: true,
      declined: false,
      message,
      proposal: validated.canDraft ? validated.proposal : null,
      requiredConnectors: validated.requiredConnectors,
      validation: {
        canActivate: validated.canActivate,
        canDraft: validated.canDraft,
        issues: validated.issues,
        requiredConnectors: validated.requiredConnectors,
        approvalSteps: validated.approvalSteps,
      },
      connectedApps: connectedList,
      thinking: sanitizePublicThinking(result.thinking),
    });
  } catch (err) {
    console.error("[api/agent-builder]", err);
    return NextResponse.json(
      {
        ok: false,
        message: "Could not draft this employee. Try again.",
      },
      { status: 500 }
    );
  }
}
