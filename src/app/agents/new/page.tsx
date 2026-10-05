"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createAgent, loadOperatorState, stepId } from "@/lib/operatorStore";
import {
  draftScopeId,
  employeeScopeId,
  loadBuilderChat,
  migrateBuilderChat,
  saveBuilderChat,
  type BuilderLine,
} from "@/lib/agentBuilder/chatStore";
import {
  canCreateAgent,
  fetchBillingStatus,
  type ClientBillingState,
} from "@/lib/clientBilling";
import type { AgentProposal } from "@/lib/agentBuilder/types";

type ChatLine = { role: "user" | "assistant"; content: string; thinking?: string[] };

export default function NewAgentPage() {
  const router = useRouter();
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [chatReady, setChatReady] = useState(false);
  const scopeRef = useRef("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinkingLive, setThinkingLive] = useState<string[]>([]);
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [requiredConnectors, setRequiredConnectors] = useState<
    { id: string; name: string; status: string }[]
  >([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState<ClientBillingState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.id) {
      router.replace("/login");
      return;
    }
    const scope = draftScopeId(s.user.id);
    scopeRef.current = scope;
    // No pre-filled employee card — wait for the user's first command
    setLines(loadBuilderChat(scope) as ChatLine[]);
    setChatReady(true);
    void fetchBillingStatus().then(setBilling);
  }, [router]);

  useEffect(() => {
    if (!chatReady || !scopeRef.current) return;
    saveBuilderChat(scopeRef.current, lines as BuilderLine[]);
  }, [lines, chatReady]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, proposal, thinkingLive]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError("");
    setProposal(null);
    setRequiredConnectors([]);
    const nextLines = [...lines, { role: "user" as const, content: text }];
    setLines(nextLines);
    setBusy(true);
    setThinkingLive([
      "Reading your request",
      "Checking available connectors and actions",
      "Designing a workflow from the registry",
    ]);
    try {
      const s = loadOperatorState();
      const res = await fetch("/api/agent-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: s.user?.id || "",
          messages: nextLines.map((l) => ({ role: l.role, content: l.content })),
        }),
      });
      const data = await res.json();
      const thinking = Array.isArray(data.thinking) ? data.thinking : [];
      setThinkingLive([]);

      if (!data.ok) {
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.message ||
              "I'm Nexa's AI Employee Builder. I can only help you hire or update AI employees.",
            thinking,
          },
        ]);
      } else if (data.declined) {
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message || "I can only help with AI employees.",
            thinking,
          },
        ]);
      } else {
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message || "Here is a proposed AI employee.",
            thinking,
          },
        ]);
        if (data.proposal) setProposal(data.proposal as AgentProposal);
        if (data.validation?.requiredConnectors) {
          setRequiredConnectors(data.validation.requiredConnectors);
        }
      }
    } catch {
      setThinkingLive([]);
      setError("Something went wrong. Please try again.");
    }
    setBusy(false);
  };

  const confirmHire = async () => {
    if (!proposal || creating) return;
    setCreating(true);
    setError("");
    try {
      const s = loadOperatorState();
      if (!s.user?.id) {
        router.replace("/login");
        return;
      }
      const bill = billing || (await fetchBillingStatus());
      const check = canCreateAgent(s.agents.length, bill);
      if (!check.ok) {
        setError(check.message || "Limit reached.");
        setCreating(false);
        return;
      }
      const steps = (proposal.steps || []).map((st, i) => ({
        id: stepId(),
        actionId: st.actionId,
        name: st.name || st.actionId,
        order: i,
        config: st.config || {},
        onError: st.onError || "stop",
      }));
      const agent = createAgent({
        userId: s.user.id,
        name: proposal.name || "AI Employee",
        purpose: proposal.purpose || proposal.description || "",
        description: proposal.description || proposal.purpose || "",
        steps,
        status: "active",
        schedule: {
          frequency: proposal.schedule?.frequency || "once",
          enabled: Boolean(proposal.schedule?.enabled),
        },
      });
      if (scopeRef.current && agent?.id) {
        migrateBuilderChat(scopeRef.current, employeeScopeId(agent.id));
      }
      router.push(`/agents/${agent.id}`);
    } catch {
      setError("Could not hire this AI employee. Please try again.");
      setCreating(false);
    }
  };

  const missingConnectors = requiredConnectors.filter(
    (c) => c.status !== "connected" && c.id !== "local_data" && c.id !== "vault"
  );

  return (
    <AppShell>
      <div
        className="mx-auto flex max-w-2xl flex-col px-4 py-6"
        style={{ minHeight: "calc(100vh - 4rem)" }}
      >
        <div className="mb-4">
          <Link href="/agents" className="text-xs text-zinc-500 hover:text-indigo-600">
            ← AI Team
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            AI Employee Builder
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Build one employee at a time — structured answers after you describe the job.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-4">
          {lines.length === 0 && !busy && (
            <p className="px-1 text-sm text-zinc-500">What should this employee do?</p>
          )}

          {lines.map((l, i) => (
            <div key={i}>
              {l.thinking && l.thinking.length > 0 && (
                <div className="mb-1 mr-8 space-y-0.5 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                  {l.thinking.map((t, j) => (
                    <div key={j} className="flex items-center gap-1.5">
                      <span className="text-emerald-500">✓</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              )}
              <div
                className={
                  l.role === "user"
                    ? "ml-8 rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white"
                    : "mr-8 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                }
              >
                {l.role === "assistant" ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
                    {l.content}
                  </pre>
                ) : (
                  l.content
                )}
              </div>
            </div>
          ))}

          {busy && thinkingLive.length > 0 && (
            <div className="mr-8 space-y-1 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
              <div className="font-medium">Working…</div>
              {thinkingLive.map((t, j) => (
                <div key={j} className="flex items-center gap-1.5 opacity-80">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          )}

          {proposal && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
              <h2 className="text-sm font-semibold">{proposal.name || "Proposed AI employee"}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {proposal.purpose || proposal.description}
              </p>
              {proposal.steps?.length > 0 && (
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                  {proposal.steps.map((st, i) => (
                    <li key={i}>{st.name || st.actionId}</li>
                  ))}
                </ol>
              )}
              {missingConnectors.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <div className="font-medium">Connectors needed</div>
                  <ul className="mt-1 list-disc pl-4">
                    {missingConnectors.map((c) => (
                      <li key={c.id}>
                        <Link href={`/connections/${c.id}`} className="underline">
                          {c.name}
                        </Link>{" "}
                        — {c.status === "coming_soon" ? "coming soon" : "not connected yet"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                disabled={creating}
                onClick={() => void confirmHire()}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating
                  ? "Hiring…"
                  : missingConnectors.length
                    ? "Hire as draft"
                    : "Hire AI Employee"}
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-0 border-t border-zinc-200 bg-zinc-50 pt-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder='e.g. "Summarize Slack every morning" or "Review HubSpot deals weekly"'
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              disabled={busy}
            />
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void send()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            One conversation per employee. Structured answers appear after your message.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
