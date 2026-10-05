"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  employeeScopeId,
  loadBuilderChatHydrated,
  saveBuilderChat,
  type BuilderLine,
} from "@/lib/agentBuilder/chatStore";
import type { AgentProposal } from "@/lib/agentBuilder/types";
import { loadOperatorState, updateAgent, stepId } from "@/lib/operatorStore";
import { patchServerAgent } from "@/lib/serverAgentClient";

/**
 * One persistent structured chat for an existing AI employee.
 * Same Employee Builder format — not a general chatbot.
 */
export function EmployeeBuilderChat({ agentId }: { agentId: string }) {
  const [lines, setLines] = useState<BuilderLine[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const scope = employeeScopeId(agentId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadBuilderChatHydrated(scope).then((msgs) => {
      // Never invent a pre-chat card — wait for the user
      setLines(msgs.length ? msgs : []);
      setReady(true);
    });
  }, [scope]);

  useEffect(() => {
    if (!ready) return;
    saveBuilderChat(scope, lines);
  }, [lines, ready, scope]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, busy]);

  const applyProposalToAgent = useCallback(
    async (proposal: AgentProposal) => {
      const steps = (proposal.steps || []).map((st, i) => ({
        id: stepId(),
        actionId: st.actionId,
        name: st.name || st.actionId,
        order: i,
        config: st.config || {},
        onError: st.onError || ("stop" as const),
      }));
      updateAgent(agentId, {
        name: proposal.name,
        purpose: proposal.purpose || proposal.description,
        description: proposal.description || proposal.purpose,
        steps,
        schedule: {
          frequency: proposal.schedule?.frequency || "once",
          time: proposal.schedule?.time || "09:00",
          timezone: proposal.schedule?.timezone || "UTC",
          enabled: Boolean(proposal.schedule?.enabled),
        },
      });
      void patchServerAgent(agentId, {
        name: proposal.name,
        description: proposal.description || proposal.purpose,
        steps,
        schedule: proposal.schedule,
      });
    },
    [agentId]
  );

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError("");
    const next = [...lines, { role: "user" as const, content: text }];
    setLines(next);
    setBusy(true);
    try {
      const s = loadOperatorState();
      const res = await fetch("/api/agent-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: s.user?.id || "",
          messages: next.map((l) => ({ role: l.role, content: l.content })),
        }),
      });
      const data = await res.json();
      const content =
        data.message ||
        (data.declined
          ? "I can only help update this AI employee."
          : "Could not update this employee.");
      setLines((prev) => [
        ...prev,
        { role: "assistant", content, thinking: data.thinking },
      ]);
      if (data.ok && data.proposal) {
        await applyProposalToAgent(data.proposal as AgentProposal);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setBusy(false);
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Employee builder
        </h2>
        <p className="text-xs text-zinc-500">
          One conversation for this employee — change schedule, tools, or workflow.
        </p>
      </div>
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto px-4 py-3">
        {lines.length === 0 && !busy && (
          <p className="text-sm text-zinc-500">Describe a change, or ask what this employee does.</p>
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
            {l.role === "assistant" ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {l.content}
              </pre>
            ) : (
              l.content
            )}
          </div>
        ))}
        {busy && <p className="text-xs text-zinc-500">Working…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
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
          placeholder='e.g. "Run every Friday at 5 PM" or "Add Slack"'
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
