"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  classifyWorkforceMessage,
  type WorkforceContext,
} from "@/lib/workforceIntent";
import { loadOperatorState } from "@/lib/operatorStore";
import {
  executeComposioTool,
  listComposioConnections,
} from "@/lib/composio/chatTools";
import { formatToolResult } from "@/lib/composio/formatToolResult";

type Line = { role: "user" | "assistant"; content: string };

type ConnAccount = { id: string; toolkit: string; status: string };

function friendlyAppName(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "app";
  const map: Record<string, string> = {
    gmail: "Gmail",
    slack: "Slack",
    notion: "Notion",
    hubspot: "HubSpot",
    github: "GitHub",
    googledrive: "Google Drive",
    googlecalendar: "Google Calendar",
    googlesheets: "Google Sheets",
    googledocs: "Google Docs",
    outlook: "Outlook",
    discord: "Discord",
    linear: "Linear",
    asana: "Asana",
    trello: "Trello",
    jira: "Jira",
    buffer: "Buffer",
    twitter: "X",
    linkedin: "LinkedIn",
    airtable: "Airtable",
    youtube: "YouTube",
  };
  const key = s.toLowerCase().replace(/\s+/g, "");
  if (map[key]) return map[key];
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isActive(status: string): boolean {
  return /ACTIVE|CONNECTED|SUCCESS|ENABLED/i.test(String(status || ""));
}

function guessTool(
  toolkit: string,
  text: string,
  toolArgs?: Record<string, unknown>
): { slug: string; args: Record<string, unknown> } | null {
  const t = text.toLowerCase();
  const tk = toolkit.toLowerCase().replace(/\s+/g, "");
  const q = String(toolArgs?.query || "").trim();

  if (tk === "gmail" || tk === "googlemail") {
    if (/send|compose|write/.test(t)) return null;
    return {
      slug: "GMAIL_FETCH_EMAILS",
      args: { max_results: /unread|latest|recent/.test(t) ? 5 : 10 },
    };
  }
  if (tk === "slack") {
    if (/send|post|message/.test(t) && !/list|channels?/.test(t)) return null;
    return { slug: "SLACK_LIST_CHANNELS", args: {} };
  }
  if (tk === "notion") {
    if (/create|new page|write/.test(t)) return null;
    return { slug: "NOTION_SEARCH", args: q ? { query: q } : { query: "" } };
  }
  if (tk === "github") {
    if (/issue/.test(t)) return { slug: "GITHUB_LIST_ISSUES_FOR_REPO", args: {} };
    return { slug: "GITHUB_LIST_REPOS_FOR_AUTHENTICATED_USER", args: {} };
  }
  if (tk === "googlecalendar" || tk === "calendar") {
    return { slug: "GOOGLECALENDAR_LIST_EVENTS", args: {} };
  }
  if (tk === "googledrive" || tk === "drive") {
    return { slug: "GOOGLEDRIVE_LIST_FILES", args: {} };
  }
  if (tk === "googlesheets" || tk === "sheets") {
    return { slug: "GOOGLESHEETS_LIST_SPREADSHEETS", args: {} };
  }
  if (tk === "googledocs" || tk === "docs") {
    return { slug: "GOOGLEDOCS_SEARCH_DOCUMENTS", args: q ? { query: q } : {} };
  }
  if (tk === "outlook") {
    if (/send/.test(t)) return null;
    if (/calendar|event/.test(t)) return { slug: "OUTLOOK_LIST_EVENTS", args: {} };
    return { slug: "OUTLOOK_LIST_MESSAGES", args: {} };
  }
  if (tk === "discord") return { slug: "DISCORD_LIST_CHANNELS", args: {} };
  if (tk === "linear") return { slug: "LINEAR_LIST_ISSUES", args: {} };
  if (tk === "asana") return { slug: "ASANA_GET_TASKS", args: {} };
  if (tk === "trello") return { slug: "TRELLO_GET_BOARDS", args: {} };
  if (tk === "jira") return { slug: "JIRA_GET_ALL_PROJECTS", args: {} };
  if (tk === "airtable") return { slug: "AIRTABLE_LIST_BASES", args: {} };
  if (tk === "linkedin") return { slug: "LINKEDIN_GET_PROFILE", args: {} };
  if (tk === "twitter" || tk === "x") return { slug: "TWITTER_USER_LOOKUP_ME", args: {} };
  if (tk === "youtube") return { slug: "YOUTUBE_LIST_CHANNEL_VIDEOS", args: {} };
  if (tk === "hubspot") return { slug: "HUBSPOT_LIST_CONTACTS", args: {} };
  if (tk === "buffer") return { slug: "BUFFER_GET_PENDING_UPDATES", args: {} };
  return null;
}

function softError(msg: string): string {
  const m = String(msg || "");
  if (/COMPOSIO|API_KEY|not configured/i.test(m)) {
    return "App connections aren’t available right now. Try again later.";
  }
  if (/not connected|no connected/i.test(m)) {
    return "That app isn’t connected. Open Connections to link it.";
  }
  return (
    m
      .replace(/\bComposio\b/gi, "")
      .replace(/\bOAuth\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || "Something went wrong. Try again."
  );
}

function recordChatUsage(userId: string, by = 2) {
  if (!userId) return;
  void fetch("/api/usage/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, by }),
  }).catch(() => {});
}

async function groundedReply(
  text: string,
  ctx: WorkforceContext,
  history: Line[]
): Promise<string | null> {
  try {
    const res = await fetch("/api/nexa/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        userName: ctx.userName,
        agentNames: ctx.agentNames,
        connectedLabels: ctx.connectedLabels,
        connectionUsed: ctx.connectionUsed,
        connectionLimit: ctx.connectionLimit,
        recentRunCount: ctx.recentRunCount,
        failedRunCount: ctx.failedRunCount,
        history: history.slice(-6).map((l) => ({
          role: l.role,
          content: l.content,
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok && typeof data.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
  } catch {
    /* */
  }
  return null;
}

export function WorkforceChat({
  agentNames = [],
  agentIdsByName = {},
  recentRunCount = 0,
  failedRunCount = 0,
}: {
  agentNames?: string[];
  agentIdsByName?: Record<string, string>;
  recentRunCount?: number;
  failedRunCount?: number;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<ConnAccount[]>([]);
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(5);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshConnections = useCallback(async () => {
    const s = loadOperatorState();
    const userId = s.user?.id || "";
    if (!userId) return;
    const listed = await listComposioConnections(userId);
    const active = listed.accounts.filter((a) => isActive(a.status));
    setAccounts(active);
    setUsed(listed.used);
    setLimit(listed.limit || 5);
  }, []);

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  const ctx: WorkforceContext = useMemo(() => {
    const s = loadOperatorState();
    const labels = accounts.map((a) => friendlyAppName(a.toolkit));
    const slugs = accounts.map((a) => a.toolkit.toLowerCase());
    return {
      userName: s.user?.name || undefined,
      agentNames,
      agentIdsByName,
      recentRunCount,
      failedRunCount,
      connectedLabels: labels,
      connectedSlugs: slugs,
      connectionUsed: used,
      connectionLimit: limit,
    };
  }, [
    agentNames,
    agentIdsByName,
    recentRunCount,
    failedRunCount,
    accounts,
    used,
    limit,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, busy]);

  const runAppOperation = async (
    text: string,
    toolkit: string,
    toolArgs?: Record<string, unknown>
  ) => {
    const s = loadOperatorState();
    const userId = s.user?.id || "";
    if (!userId) {
      setLines((prev) => [
        ...prev,
        { role: "assistant", content: "Sign in to use connected apps." },
      ]);
      return;
    }

    const listed = await listComposioConnections(userId);
    const active = listed.accounts.filter((a) => isActive(a.status));
    setAccounts(active);
    setUsed(listed.used);
    setLimit(listed.limit || 5);

    if (!active.length) {
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "No apps connected yet. Open Connections to link an account.",
        },
      ]);
      return;
    }

    const label = friendlyAppName(toolkit);
    const match = active.find(
      (a) =>
        a.toolkit.toLowerCase() === toolkit.toLowerCase() ||
        a.toolkit.toLowerCase().includes(toolkit.toLowerCase()) ||
        toolkit.toLowerCase().includes(a.toolkit.toLowerCase())
    );

    if (!match) {
      const have = active.map((a) => friendlyAppName(a.toolkit)).join(", ");
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${label} isn’t connected. Connected: ${have || "none"}.`,
        },
      ]);
      return;
    }

    const tool = guessTool(toolkit, text, toolArgs);
    if (!tool) {
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${label} is connected. For safety I only auto-run read actions from chat (list, check, show). Say something like “list channels” or “check inbox”.`,
        },
      ]);
      return;
    }

    const exec = await executeComposioTool({
      userId,
      toolSlug: tool.slug,
      connectedAccountId: match.id,
      arguments: tool.args,
    });

    if (!exec.ok) {
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Couldn’t complete that with ${label}. ${softError(exec.error)}`,
        },
      ]);
      return;
    }

    setLines((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `${label}:\n${formatToolResult(exec.result)}`,
      },
    ]);
  };

  const handleResult = async (text: string) => {
    const result = classifyWorkforceMessage(text, ctx);
    const prior = lines;
    setLines((prev) => [...prev, { role: "user", content: text }]);

    if (result.hireHint && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("nexa_hire_hint", result.hireHint);
      } catch {
        /* */
      }
    }

    if (result.intent === "app_operation" && result.toolkit) {
      await runAppOperation(text, result.toolkit, result.toolArgs);
      return;
    }

    if (result.intent === "list_connected") {
      await refreshConnections();
      const listed = await listComposioConnections(
        loadOperatorState().user?.id || ""
      );
      const active = listed.accounts.filter((a) => isActive(a.status));
      const labels = active.map((a) => friendlyAppName(a.toolkit));
      const msg =
        labels.length > 0
          ? `Connected (${listed.used}/${listed.limit || 5}): ${labels.join(", ")}.`
          : `Nothing connected (${listed.used}/${listed.limit || 5} slots).`;
      setLines((prev) => [...prev, { role: "assistant", content: msg }]);
      if (!labels.length && result.navigateTo) {
        window.setTimeout(() => router.push(result.navigateTo!), 400);
      }
      return;
    }

    const needsBrain =
      result.intent === "chat" ||
      result.intent === "capabilities" ||
      result.intent === "clarify" ||
      result.intent === "unsupported" ||
      (text.length > 40 && !result.navigateTo);

    if (needsBrain && !result.navigateTo) {
      const smart = await groundedReply(text, ctx, [
        ...prior,
        { role: "user", content: text },
      ]);
      if (smart) {
        setLines((prev) => [...prev, { role: "assistant", content: smart }]);
        return;
      }
    }

    setLines((prev) => [
      ...prev,
      { role: "assistant", content: result.message },
    ]);

    if (result.navigateTo) {
      window.setTimeout(() => router.push(result.navigateTo!), 280);
    }
  };

  const send = async () => {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    setBusy(true);
    try {
      await handleResult(t);
      const uid = loadOperatorState().user?.id || "";
      recordChatUsage(uid, 2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Nexa
        </h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Team · apps · work — trained on your digital workforce
        </p>
      </div>
      <div className="flex max-h-80 min-h-[12rem] flex-col gap-2 overflow-y-auto px-4 py-3">
        {lines.length === 0 && (
          <div className="space-y-1 text-sm text-zinc-400 dark:text-zinc-500">
            <p>Ask anything about your team, work, or connected apps.</p>
            <p className="text-xs">
              Examples: “what’s connected”, “check gmail”, “list my team”, “hire a research employee”
            </p>
          </div>
        )}
        {lines.map((l, i) => (
          <div
            key={i}
            className={
              l.role === "user"
                ? "ml-6 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
                : "mr-6 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            }
          >
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {l.content}
            </pre>
          </div>
        ))}
        {busy && <p className="text-xs text-zinc-500">Working…</p>}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message Nexa…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          disabled={busy}
        />
        <button
          type="button"
          disabled={busy || !input.trim()}
          onClick={() => void send()}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </section>
  );
}
