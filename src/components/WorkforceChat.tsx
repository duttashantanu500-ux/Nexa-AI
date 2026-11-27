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

function guessToolSlug(toolkit: string, text: string): string | null {
  const t = text.toLowerCase();
  const tk = toolkit.toLowerCase();
  if (tk === "gmail") {
    if (/send|compose/.test(t)) return null;
    return "GMAIL_FETCH_EMAILS";
  }
  if (tk === "slack") {
    if (/send|post/.test(t)) return null;
    return "SLACK_LIST_CHANNELS";
  }
  if (tk === "notion") {
    if (/create|new page/.test(t)) return null;
    return "NOTION_SEARCH";
  }
  if (tk === "hubspot") return "HUBSPOT_LIST_CONTACTS";
  if (tk === "github") return "GITHUB_LIST_REPOS_FOR_AUTHENTICATED_USER";
  if (tk === "googlecalendar") return "GOOGLECALENDAR_LIST_EVENTS";
  if (tk === "googledrive") return "GOOGLEDRIVE_LIST_FILES";
  if (tk === "googlesheets") return "GOOGLESHEETS_LIST_SPREADSHEETS";
  if (tk === "outlook") {
    if (/send/.test(t)) return null;
    return "OUTLOOK_LIST_MESSAGES";
  }
  if (tk === "discord") return "DISCORD_LIST_CHANNELS";
  if (tk === "linear") return "LINEAR_LIST_ISSUES";
  if (tk === "asana") return "ASANA_GET_TASKS";
  if (tk === "trello") return "TRELLO_GET_BOARDS";
  if (tk === "jira") return "JIRA_GET_ALL_PROJECTS";
  if (tk === "airtable") return "AIRTABLE_LIST_BASES";
  return null;
}

function formatToolResult(result: unknown): string {
  try {
    if (result == null) return "Done.";
    if (typeof result === "string") return result.slice(0, 1600);
    const obj = result as Record<string, unknown>;
    const data = (obj.data ?? obj.result ?? obj) as unknown;
    if (Array.isArray(data)) {
      return `Found ${data.length} item${data.length === 1 ? "" : "s"}.`;
    }
    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      // Common list shapes
      for (const k of [
        "messages",
        "emails",
        "channels",
        "items",
        "files",
        "events",
        "repos",
        "repositories",
        "issues",
        "tasks",
        "boards",
        "contacts",
        "pages",
      ]) {
        if (Array.isArray(d[k])) {
          const n = (d[k] as unknown[]).length;
          return `Found ${n} ${k}.`;
        }
      }
      const keys = Object.keys(d);
      if (keys.length === 0) return "Done.";
      return "Got a response from the app.";
    }
    return "Done.";
  } catch {
    return "Done.";
  }
}

function softError(msg: string): string {
  const m = String(msg || "");
  if (/COMPOSIO|API_KEY|not configured/i.test(m)) {
    return "App connections aren’t available right now. Try again later.";
  }
  return (
    m
      .replace(/\bComposio\b/gi, "")
      .replace(/\bOAuth\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || "Something went wrong. Try again."
  );
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
  const [limit, setLimit] = useState(3);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshConnections = useCallback(async () => {
    const s = loadOperatorState();
    const userId = s.user?.id || "";
    if (!userId) return;
    const listed = await listComposioConnections(userId);
    const active = listed.accounts.filter((a) => isActive(a.status));
    setAccounts(active);
    setUsed(listed.used);
    setLimit(listed.limit || 3);
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

  const runAppOperation = async (text: string, toolkit: string) => {
    const s = loadOperatorState();
    const userId = s.user?.id || "";
    if (!userId) {
      setLines((prev) => [
        ...prev,
        { role: "assistant", content: "Sign in to use connected apps." },
      ]);
      return;
    }

    // Refresh so we don't use stale connection state
    const listed = await listComposioConnections(userId);
    const active = listed.accounts.filter((a) => isActive(a.status));
    setAccounts(active);
    setUsed(listed.used);
    setLimit(listed.limit || 3);

    if (!active.length) {
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "No apps connected yet. Open Connections to link an account.",
        },
      ]);
      return;
    }

    const label = friendlyAppName(toolkit);
    const match = active.find(
      (a) =>
        a.toolkit.toLowerCase() === toolkit.toLowerCase() ||
        a.toolkit.toLowerCase().includes(toolkit.toLowerCase())
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

    const toolSlug = guessToolSlug(toolkit, text);
    if (!toolSlug) {
      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${label} is connected. Ask a specific read action (e.g. list, check, show).`,
        },
      ]);
      return;
    }

    const exec = await executeComposioTool({
      userId,
      toolSlug,
      connectedAccountId: match.id,
      arguments: {},
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
        content: `${label}: ${formatToolResult(exec.result)}`,
      },
    ]);
  };

  const handleResult = async (text: string) => {
    const result = classifyWorkforceMessage(text, ctx);
    setLines((prev) => [...prev, { role: "user", content: text }]);

    if (result.hireHint && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("nexa_hire_hint", result.hireHint);
      } catch {
        /* */
      }
    }

    if (result.intent === "app_operation" && result.toolkit) {
      await runAppOperation(text, result.toolkit);
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
          ? `Connected (${listed.used}/${listed.limit || 3}): ${labels.join(", ")}.`
          : `Nothing connected (${listed.used}/${listed.limit || 3} slots).`;
      setLines((prev) => [...prev, { role: "assistant", content: msg }]);
      return;
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
      </div>
      <div className="flex max-h-80 min-h-[12rem] flex-col gap-2 overflow-y-auto px-4 py-3">
        {lines.length === 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Ask anything about your team, work, or connected apps.
          </p>
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
