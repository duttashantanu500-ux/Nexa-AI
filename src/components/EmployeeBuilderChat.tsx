"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  emptyStateForEmployee,
  type IntentContext,
} from "@/lib/employeeIntent";

/** In-memory connection status cache to avoid repeated status fetches */
let connectedCache: { at: number; map: Record<string, boolean> } | null = null;
const CONNECTED_TTL_MS = 30_000;

/**
 * Chat for an EXISTING AI employee.
 * Understands intent: conversation, real work, configuration, history, refusal.
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
  const [, bump] = useState(0);

  const intentCtxBase = useMemo((): Omit<IntentContext, "connected"> => {
    const a = getAgent(agentId);
    const schedule = a?.schedule;
    let scheduleLabel = "";
    if (schedule?.enabled && schedule.frequency && schedule.frequency !== "once") {
      scheduleLabel = `${schedule.frequency}${schedule.time ? ` at ${schedule.time}` : ""}${
        schedule.timezone ? ` (${schedule.timezone})` : ""
      }`;
    } else if (schedule?.frequency === "once" || !schedule?.enabled) {
      scheduleLabel = "manual / on demand";
    }
    return {
      agentName: a?.name || "this employee",
      purpose: a?.purpose,
      description: a?.description,
      actionIds: (a?.steps || []).map((s) => s.actionId),
      stepNames: (a?.steps || []).map((s) => s.name || s.actionId),
      hasSteps: Boolean(a?.steps?.length),
      scheduleLabel,
    };
  }, [agentId, lines, ready, busy]);

  const empty = useMemo(
    () => emptyStateForEmployee({ ...intentCtxBase, connected: {} }),
    [intentCtxBase]
  );

  const agentName = intentCtxBase.agentName;

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
    const now = Date.now();
    if (connectedCache && now - connectedCache.at < CONNECTED_TTL_MS) {
      return connectedCache.map;
    }
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
      connectedCache = { at: now, map: out };
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
      bump((n) => n + 1);
    },
    [agentId]
  );

  const sendConfigure = async (next: BuilderLine[]) => {
    const s = loadOperatorState();
    const agentRow = getAgent(agentId);
    const existingAgent = agentRow
      ? {
          name: agentRow.name,
          purpose: agentRow.purpose,
          description: agentRow.description,
          steps: (agentRow.steps || []).map((st) => ({
            actionId: st.actionId,
            name: st.name,
            config: st.config || {},
          })),
          schedule: agentRow.schedule,
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
      const needsConnectionCheck =
        /\b(start|run|work|publish|post|create|list|send|hubspot|notion|slack|buffer|connect)\b/i.test(
          trimmed
        );
      const connected = needsConnectionCheck
        ? await loadConnectedMap()
        : connectedCache?.map || {};

      const ctx: IntentContext = {
        ...intentCtxBase,
        connected,
      };

      const result = classifyEmployeeMessage(trimmed, ctx);

      if (result.intent === "configure" || result.suggestConfigure) {
        if (result.message) {
          setLines((prev) => [
            ...prev,
            { role: "assistant", content: result.message },
          ]);
        }
        await sendConfigure(next);
        setBusy(false);
        return;
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
      const agentRow = getAgent(agentId);
      if (agentRow?.steps?.length) {
        const steps = injectNotionParentIntoSteps(
          agentRow.steps.map((st) => ({
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
          Manage {agentName} — work, schedule, steps, or history.
        </p>
      </div>
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <LiveAccountPicker onPick={onPick} />
      </div>
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto px-4 py-3">
        {lines.length === 0 && !busy && (
          <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {empty.headline}
            </p>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {empty.body}
            </pre>
            <div className="flex flex-wrap gap-2 pt-1">
              {empty.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void sendText(s)}
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
          placeholder='e.g. "Start work" · "Every Friday at 5 PM" · "What did you work on?"'
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
