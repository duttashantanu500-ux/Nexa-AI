"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  classifyWorkforceMessage,
  workforceEmptyState,
  type WorkforceContext,
} from "@/lib/workforceIntent";
import { loadOperatorState } from "@/lib/operatorStore";
import {
  executeComposioTool,
  listComposioConnections,
} from "@/lib/composio/chatTools";

type Line = { role: "user" | "assistant"; content: string };

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
  return null;
}

function formatToolResult(result: unknown): string {
  try {
    const s = JSON.stringify(result, null, 2);
    if (s.length > 1800) return s.slice(0, 1800) + "\n…";
    return s;
  } catch {
    return String(result);
  }
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
  const bottomRef = useRef<HTMLDivElement>(null);

  const ctx: WorkforceContext = useMemo(() => {
    const s = loadOperatorState();
    return {
      userName: s.user?.name || undefined,
      agentNames,
      agentIdsByName,
      recentRunCount,
      failedRunCount,
    };
  }, [agentNames, agentIdsByName, recentRunCount, failedRunCount]);

  const empty = useMemo(() => workforceEmptyState(ctx), [ctx]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, busy]);

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

    if (result.intent === "app_operation") {
      const s = loadOperatorState();
      const userId = s.user?.id || "";
      if (!userId) {
        setLines((prev) => [
          ...prev,
          { role: "assistant", content: "Sign in to use connected apps." },
        ]);
        return;
      }

      const toolkit = result.toolkit;
      const listed = await listComposioConnections(userId);
      const accounts = listed.accounts.filter((a) =>
        /ACTIVE|CONNECTED|SUCCESS/i.test(a.status)
      );

      if (!accounts.length) {
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "No apps are connected yet. Open Connections to link up to 3 accounts, then ask again.",
          },
        ]);
        window.setTimeout(() => router.push("/connections"), 400);
        return;
      }

      if (toolkit) {
        const match = accounts.find(
          (a) =>
            a.toolkit.toLowerCase() === toolkit ||
            a.toolkit.toLowerCase().includes(toolkit)
        );
        if (!match) {
          setLines((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `${toolkit} isn’t connected. You have: ${accounts
                .map((a) => a.toolkit)
                .join(", ")}. Open Connections to link ${toolkit} (slot ${listed.used}/${listed.limit}).`,
            },
          ]);
          window.setTimeout(() => router.push("/connections"), 500);
          return;
        }

        const toolSlug = guessToolSlug(toolkit, text);
        if (!toolSlug) {
          setLines((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `${toolkit} is connected. For this request I need a clearer action or an AI employee with that tool assigned — I won’t guess write actions from chat alone.`,
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
              content: `Couldn’t complete that with ${toolkit}: ${exec.error}`,
            },
          ]);
          return;
        }

        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Result from ${toolkit}:\n${formatToolResult(exec.result)}`,
          },
        ]);
        return;
      }

      setLines((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Connected apps (${listed.used}/${listed.limit}): ${accounts
            .map((a) => a.toolkit)
            .join(", ")}. Name the app and what you want done.`,
        },
      ]);
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

  const quick = async (t: string) => {
    if (busy) return;
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
        <p className="text-xs text-zinc-500">
          Hire AI employees, check work, use connected apps — in plain language.
        </p>
      </div>
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto px-4 py-3">
        {lines.length === 0 && (
          <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {empty.headline}
            </p>
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {empty.body}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {empty.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void quick(s)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-600"
                >
                  {s}
                </button>
              ))}
            </div>
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
          placeholder='e.g. "Check my latest Gmail messages" · "Hire a research employee"'
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
