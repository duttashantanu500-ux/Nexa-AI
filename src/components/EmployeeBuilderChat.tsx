"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  employeeScopeId,
  loadBuilderChatHydrated,
  saveBuilderChat,
  type BuilderLine,
} from "@/lib/agentBuilder/chatStore";
import type { AgentProposal } from "@/lib/agentBuilder/types";
import {
  getAgent,
  loadOperatorState,
  updateAgent,
  stepId,
} from "@/lib/operatorStore";
import { patchServerAgent } from "@/lib/serverAgentClient";
import {
  LiveAccountPicker,
  livePickToMessage,
  type LivePick,
} from "@/components/LiveAccountPicker";
import {
  injectNotionParentIntoSteps,
  resolveNotionParentForHire,
  setNotionParent,
} from "@/lib/notionParent";
import {
  classifyEmployeeMessage,
  type IntentContext,
} from "@/lib/employeeIntent";

/**
 * Chat for an EXISTING AI employee.
 * Understands intent: conversation, real work, configuration, refusal.
 */
export function EmployeeBuilderChat({
  agentId,
  onRequestWork,
}: {
  agentId: string;
  /** Called when the user clearly asks to run assigned work */
  onRequestWork?: () => void | Promise<void>;
}) {
  const [lines, setLines] = useState<BuilderLine[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const scope = employeeScopeId(agentId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadBuilderChatHydrated(scope).then((msgs) => {
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

  const loadConnectedMap = async (): Promise<Record<string, boolean>> => {
    const out: Record<string, boolean> = {};
    try {
      const s = loadOperatorState();
      const uid = s.user?.id || "";
      if (!uid) return out;
      const res = await fetch(
        `/api/connections/status?userId=${encodeURIComponent(uid)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      const statuses = data?.statuses || {};
      for (const [k, v] of Object.entries(statuses)) {
        out[k] = String((v as { status?: string })?.status || "") === "connected";
      }
    } catch {
      /* */
    }
    return out;
  };

  const applyProposalToAgent = useCallback(
    async (proposal: AgentProposal) => {
      const s = loadOperatorState();
      const resolved = await resolveNotionParentForHire(s.user?.id);
      let steps = (proposal.steps || []).map((st, i) => ({
        id: stepId(),
        actionId: st.actionId,
        name: st.name || st.actionId,
        order: i,
        config: (st.config || {}) as Record<string, unknown>,
        onError: st.onError || ("stop" as const),
      }));
      if (resolved.parentId) {
        steps = injectNotionParentIntoSteps(
          steps,
          resolved.parentId,
          resolved.parentLabel
        );
      }
      updateAgent(agentId, {
        name: proposal.name,
        purpose: proposal.purpose || proposal.description,
        description: proposal.description || proposal.purpose,
        steps: steps as any,
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

  const sendConfigure = async (next: BuilderLine[]) => {
    const s = loadOperatorState();
    const agent = getAgent(agentId);
    const existingAgent = agent
      ? {
          name: agent.name,
          purpose: agent.purpose,
          description: agent.description,
          steps: (agent.steps || []).map((st) => ({
            actionId: st.actionId,
            name: st.name,
            config: st.config || {},
          })),
          schedule: agent.schedule,
        }
      : undefined;

    const res = await fetch("/api/agent-builder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: s.user?.id || "",
        mode: "edit",
        existingAgent,
        messages: next.map((l) => ({ role: l.role, content: l.content })),
      }),
    });
    const data = await res.json();
    const content =
      data.message ||
      (data.declined
        ? "I can only help update this AI employee — schedule, tools, or steps."
        : "Could not update this employee.");
    setLines((prev) => [
      ...prev,
      { role: "assistant", content, thinking: data.thinking },
    ]);
    if (data.ok && data.proposal) {
      await applyProposalToAgent(data.proposal as AgentProposal);
    }
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError("");
    const next = [...lines, { role: "user" as const, content: trimmed }];
    setLines(next);
    setBusy(true);
    try {
      const agent = getAgent(agentId);
      const connected = await loadConnectedMap();
      const ctx: IntentContext = {
        agentName: agent?.name || "this employee",
        purpose: agent?.purpose,
        description: agent?.description,
        actionIds: (agent?.steps || []).map((s) => s.actionId),
        connected,
        hasSteps: Boolean(agent?.steps?.length),
      };

      const result = classifyEmployeeMessage(trimmed, ctx);

      // Configuration changes go through the builder (edit mode only)
      if (
        result.intent === "configure" ||
        (/\b(change|update|edit|rename|schedule|every|add|remove|step|timezone|parent page|channel)\b/i.test(
          trimmed
        ) &&
          result.intent !== "work" &&
          result.intent !== "refuse")
      ) {
        if (
          /\b(change|update|edit|rename|schedule|every|add|remove|step|timezone|parent page|channel)\b/i.test(
            trimmed
          )
        ) {
          await sendConfigure(next);
          setBusy(false);
          return;
        }
      }

      setLines((prev) => [
        ...prev,
        { role: "assistant", content: result.message },
      ]);

      if (result.shouldStartWork && onRequestWork) {
        try {
          await onRequestWork();
        } catch {
          /* parent surfaces errors */
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setBusy(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendText(text);
  };

  const onPick = (pick: LivePick) => {
    if (busy) return;
    if (pick.kind === "notion_page" && pick.option?.id) {
      setNotionParent(pick.option.id);
      const agent = getAgent(agentId);
      if (agent?.steps?.length) {
        const steps = injectNotionParentIntoSteps(
          agent.steps.map((st) => ({
            ...st,
            config: (st.config || {}) as Record<string, unknown>,
          })),
          pick.option.id,
          pick.option.label
        );
        updateAgent(agentId, { steps: steps as any });
        void patchServerAgent(agentId, { steps });
      }
    }
    void sendText(livePickToMessage(pick));
  };

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Talk to this employee
        </h2>
        <p className="text-xs text-zinc-500">
          Ask what they do, run their work, or change schedule and steps.
        </p>
      </div>
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <LiveAccountPicker onPick={onPick} />
      </div>
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto px-4 py-3">
        {lines.length === 0 && !busy && (
          <p className="text-sm text-zinc-500">
            Try: “What do you do?”, “Start work”, “Run every Friday at 5 PM”, or
            pick a page/channel above.
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
          placeholder='e.g. "What do you do?" · "Start work" · "Every Friday at 5 PM"'
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
