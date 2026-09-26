"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createAgent, loadOperatorState, stepId } from "@/lib/operatorStore";
import { getAction } from "@/lib/actionRegistry";
import {
  defaultPermissions,
  defaultSchedule,
  type ScheduleFrequency,
  type WorkflowStep,
} from "@/types";
import type { ValidatedProposal } from "@/lib/agentBuilder/types";

interface ChatLine {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function NewAgentPage() {
  const router = useRouter();
  const [lines, setLines] = useState<ChatLine[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Describe the automation agent you want. I'll propose a workflow using only Nexa's available connectors and actions — then you confirm before anything is created.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState<ValidatedProposal | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) router.replace("/signup");
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, validated]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    setValidated(null);

    const userLine: ChatLine = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    const nextLines = [...lines, userLine];
    setLines(nextLines);
    setLoading(true);

    try {
      const res = await fetch("/api/agent-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextLines
            .filter((l) => l.id !== "welcome")
            .map((l) => ({ role: l.role, content: l.content })),
        }),
      });
      const data = await res.json();

      if (data.kind === "off_topic") {
        setLines((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content:
              data.message ||
              "I'm Nexa's Agent Builder. I can only help you create or modify automation agents.",
          },
        ]);
        return;
      }

      if (!data.ok || data.kind === "error") {
        setError(data.message || "Something went wrong.");
        setLines((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.message || "Could not build a proposal. Try again.",
          },
        ]);
        return;
      }

      setLines((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.message || "Here is a proposed agent. Review it below.",
        },
      ]);
      setValidated(data.validated as ValidatedProposal);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const createFromProposal = (asDraft: boolean) => {
    if (!validated) return;
    const s = loadOperatorState();
    if (!s.user) return;

    if (!asDraft && !validated.canActivate) {
      setError("Cannot activate until all actions are available. Save as draft instead.");
      return;
    }
    if (!validated.canDraft) {
      setError("Proposal is not complete enough to save.");
      return;
    }

    setCreating(true);
    const p = validated.proposal;
    const steps: WorkflowStep[] = p.steps.map((st, i) => {
      const def = getAction(st.actionId);
      return {
        id: stepId(),
        order: i,
        type: "action",
        actionId: st.actionId,
        name: def?.name || st.name || st.actionId,
        connectorId: def?.connectionId || undefined,
        config: { ...(st.config || {}) },
        onError: st.onError || "stop",
        requiresApproval: def?.requiresApproval || st.requiresApproval,
      };
    });

    const frequency = p.schedule.frequency as ScheduleFrequency;
    const agent = createAgent({
      userId: s.user.id,
      name: p.name.trim(),
      description: p.description || "",
      purpose: p.purpose || p.description || "",
      instructions: p.purpose || p.description || "",
      steps,
      tools: [...new Set(steps.map((st) => st.actionId))],
      permissions: defaultPermissions(),
      schedule: {
        ...defaultSchedule(),
        frequency,
        time: p.schedule.time || "09:00",
        timezone:
          p.schedule.timezone ||
          (typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : "UTC"),
        enabled: frequency !== "once",
      },
      status: asDraft ? "draft" : validated.canActivate ? "active" : "ready",
    });
    router.push(`/agents/${agent.id}`);
  };

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col px-4 py-6" style={{ minHeight: "calc(100vh - 4rem)" }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <Link href="/agents" className="text-xs text-zinc-500 hover:text-indigo-600">
              ← Agents
            </Link>
            <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Agent Builder
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Natural language only for creating agents — not a general chatbot.
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-4">
          {lines.map((l) => (
            <div
              key={l.id}
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm ${
                l.role === "user"
                  ? "ml-auto bg-indigo-600 text-white"
                  : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              {l.content}
            </div>
          ))}

          {loading && (
            <div className="text-sm text-zinc-500">Designing workflow…</div>
          )}

          {validated && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Workflow preview
              </div>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {validated.proposal.name}
              </h2>
              {validated.proposal.description && (
                <p className="mt-1 text-sm text-zinc-500">{validated.proposal.description}</p>
              )}

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] uppercase text-zinc-400">Trigger</dt>
                  <dd className="capitalize">{validated.proposal.trigger}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-zinc-400">Schedule</dt>
                  <dd>
                    {validated.proposal.schedule.frequency}
                    {validated.proposal.schedule.frequency !== "once"
                      ? ` · ${validated.proposal.schedule.time || "09:00"}`
                      : " · Run now only"}
                  </dd>
                </div>
              </dl>

              <div className="mt-3">
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Steps</div>
                <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm">
                  {validated.proposal.steps.map((s, i) => (
                    <li key={`${s.actionId}-${i}`}>
                      {s.name || s.actionId}
                      <span className="ml-1 font-mono text-[10px] text-zinc-400">
                        {s.actionId}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {validated.requiredConnectors.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase text-zinc-400">
                    Required connections
                  </div>
                  <ul className="mt-1 space-y-1 text-sm">
                    {validated.requiredConnectors.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2">
                        <span>{c.name}</span>
                        <span className="text-[10px] capitalize text-zinc-500">
                          {c.status.replace(/_/g, " ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {validated.approvalSteps.length > 0 && (
                <div className="mt-3 text-sm">
                  <div className="text-[11px] font-semibold uppercase text-zinc-400">
                    Requires approval
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {validated.approvalSteps.join(", ")}
                  </p>
                </div>
              )}

              {validated.issues.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {validated.issues.map((iss, i) => (
                    <li
                      key={iss.code + i}
                      className={
                        iss.severity === "error" ? "text-amber-700 dark:text-amber-300" : "text-zinc-500"
                      }
                    >
                      {iss.message}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={creating || !validated.canActivate}
                  onClick={() => createFromProposal(false)}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-40"
                >
                  {creating ? "Creating…" : "Create agent"}
                </button>
                <button
                  type="button"
                  disabled={creating || !validated.canDraft}
                  onClick={() => createFromProposal(true)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValidated(null);
                    setInput("Change the proposal: ");
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                >
                  Edit in chat
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-0 border-t border-zinc-200 bg-white pt-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder='e.g. "Create an agent that filters a list daily and builds a report"'
              className="flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="button"
              disabled={loading || !input.trim()}
              onClick={() => void send()}
              className="self-end rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Send
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-400">
            Unrelated questions are declined. Agents are only created after you confirm.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
