"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createAgent, loadOperatorState, stepId } from "@/lib/operatorStore";
import {
  canCreateAgent,
  fetchBillingStatus,
  type BillingStatusResponse,
} from "@/lib/clientBilling";
import type { ValidatedProposal } from "@/lib/agentBuilder/types";

type ChatLine = { role: "user" | "assistant"; content: string };

export default function NewAgentPage() {
  const router = useRouter();
  const [lines, setLines] = useState<ChatLine[]>([
    {
      role: "assistant",
      content:
        "Describe the AI employee you want on your team. I'll propose a workflow using only Nexa's available connectors and actions — then you confirm before anything is hired.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<ValidatedProposal | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.id) {
      router.replace("/login");
      return;
    }
    void fetchBillingStatus().then(setBilling);
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, proposal]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError("");
    setProposal(null);
    const nextLines = [...lines, { role: "user" as const, content: text }];
    setLines(nextLines);
    setBusy(true);
    try {
      const res = await fetch("/api/agent-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextLines.map((l) => ({ role: l.role, content: l.content })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.message ||
              "I'm Nexa's AI Employee Builder. I can only help you hire or update AI employees.",
          },
        ]);
      } else {
        setLines((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message || "Here is a proposed AI employee. Review them below.",
          },
        ]);
        if (data.proposal) setProposal(data.proposal as ValidatedProposal);
      }
    } catch {
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
      const check = canCreateAgent(s.agents.length, billing);
      if (!check.ok) {
        setError(check.message || "Limit reached.");
        setCreating(false);
        return;
      }
      const steps = (proposal.steps || []).map((st: any, i: number) => ({
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
          frequency: "once",
          enabled: false,
        },
      });
      router.push(`/agents/${agent.id}`);
    } catch {
      setError("Could not hire this AI employee. Please try again.");
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col px-4 py-6" style={{ minHeight: "calc(100vh - 4rem)" }}>
        <div className="mb-4">
          <Link href="/agents" className="text-xs text-zinc-500 hover:text-indigo-600">
            ← AI Team
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            AI Employee Builder
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Natural language only for hiring AI employees — not a general chatbot.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-4">
          {lines.map((l, i) => (
            <div
              key={i}
              className={
                l.role === "user"
                  ? "ml-8 rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white"
                  : "mr-8 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              }
            >
              {l.content}
            </div>
          ))}

          {proposal && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
              <h2 className="text-sm font-semibold">{proposal.name || "Proposed AI employee"}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {proposal.purpose || proposal.description}
              </p>
              {proposal.steps?.length > 0 && (
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
                  {proposal.steps.map((st: any, i: number) => (
                    <li key={i}>{st.name || st.actionId}</li>
                  ))}
                </ol>
              )}
              <button
                type="button"
                disabled={creating}
                onClick={() => void confirmHire()}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {creating ? "Hiring…" : "Hire AI Employee"}
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
              placeholder='e.g. "Hire a research employee who filters a list daily and builds a report"'
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
            Unrelated questions are declined. AI employees are only hired after you confirm.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
