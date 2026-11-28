"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import {
  getAgent,
  loadOperatorState,
  saveOperatorState,
  updateAgentRun,
} from "@/lib/operatorStore";
import { fetchServerAgents } from "@/lib/serverAgentClient";
import { authHeaders } from "@/lib/authHeaders";
import { runWorkflow } from "@/lib/workflowEngine";
import {
  mapWorkflowResultToRunStatus,
  runStatusLabel,
  statusBadgeClass,
} from "@/lib/runLifecycle";
import { getNotionParent } from "@/lib/notionParent";
import type { Agent, AgentRun, WorkflowStep } from "@/types";

type FilterKey =
  | "all"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed";

type BoardItem = {
  run: AgentRun;
  agentName: string;
  agentId: string;
};

function normalizeStatus(s: string): string {
  return String(s || "").toLowerCase();
}

function isWaiting(status: string): boolean {
  const s = normalizeStatus(status);
  return s === "waiting_for_approval" || s === "waiting_approval";
}

function matchesFilter(status: string, filter: FilterKey): boolean {
  const s = normalizeStatus(status);
  if (filter === "all") return true;
  if (filter === "running") return s === "running" || s === "queued";
  if (filter === "waiting") return isWaiting(s);
  if (filter === "succeeded")
    return (
      s === "succeeded" ||
      s === "completed" ||
      s === "succeeded_with_errors" ||
      s === "partial"
    );
  if (filter === "failed") return s === "failed" || s === "cancelled";
  return true;
}

function toWorkflowSteps(agent: Agent): WorkflowStep[] {
  const raw = Array.isArray(agent.steps) ? agent.steps : [];
  return raw.map((st: any, i: number) => ({
    id: String(st.id || `step_${i}`),
    order: typeof st.order === "number" ? st.order : i,
    actionId: String(st.actionId || ""),
    name: String(st.name || st.actionId || `Step ${i + 1}`),
    config: Object.fromEntries(
      Object.entries((st.config || {}) as Record<string, unknown>).map(([k, v]) => [
        k,
        v == null ? "" : String(v),
      ])
    ),
    onError: st.onError === "continue" || st.onError === "retry" ? st.onError : "stop",
    requiresApproval: Boolean(st.requiresApproval),
  }));
}

export default function WorkBoardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    const s = loadOperatorState();
    if (!s.user) {
      router.replace("/login");
      return;
    }
    if (!s.user.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
    const uid = s.user?.id || "";

    let localAgents = (s.agents || []).filter((a) => String(a.status) !== "archived");
    if (uid) {
      const matched = localAgents.filter((a) => !a.userId || a.userId === uid);
      if (matched.length > 0) localAgents = matched;
    }

    try {
      const remote = await fetchServerAgents();
      if (remote.ok && Array.isArray(remote.agents)) {
        const byId = new Map<string, Agent>();
        for (const a of localAgents) byId.set(a.id, a);
        for (const r of remote.agents) {
          if (!r?.id) continue;
          const prev = byId.get(r.id);
          byId.set(r.id, {
            ...(prev || ({} as Agent)),
            id: r.id,
            userId: uid || prev?.userId || "",
            name: r.name || prev?.name || "AI Employee",
            purpose: r.purpose || r.description || prev?.purpose || "",
            description: r.description || prev?.description || "",
            status: r.status || prev?.status || "active",
            steps: Array.isArray(r.steps) && r.steps.length ? r.steps : prev?.steps || [],
            schedule: prev?.schedule || { frequency: "once", enabled: false },
            createdAt: r.createdAt || prev?.createdAt || new Date().toISOString(),
            updatedAt: r.updatedAt || prev?.updatedAt || new Date().toISOString(),
          } as Agent);
        }
        localAgents = Array.from(byId.values()).filter(
          (a) => String(a.status) !== "archived"
        );
        const st = loadOperatorState();
        st.agents = localAgents;
        saveOperatorState(st);
      }
    } catch {
      /* keep local */
    }

    setAgents(localAgents);

    const localRuns = (s.agentRuns || []).filter((r) => {
      if (r.isTest || r.mode === "simulated") return false;
      if (uid && r.userId && r.userId !== uid) return false;
      return true;
    });

    const byRunId = new Map<string, BoardItem>();
    const nameOf = (agentId: string) =>
      localAgents.find((a) => a.id === agentId)?.name || "Employee";

    for (const r of localRuns) {
      byRunId.set(r.id, {
        run: r,
        agentId: r.agentId,
        agentName: nameOf(r.agentId),
      });
    }

    const headers = await authHeaders();
    if (headers.Authorization) {
      await Promise.all(
        localAgents.slice(0, 20).map(async (a) => {
          try {
            const res = await fetch(
              `/api/agents/${encodeURIComponent(a.id)}/runs`,
              { headers, cache: "no-store" }
            );
            if (!res.ok) return;
            const data = await res.json().catch(() => ({}));
            const runs = Array.isArray(data.runs) ? data.runs : [];
            for (const raw of runs) {
              if (!raw?.id) continue;
              if (raw.isTest || raw.mode === "simulated") continue;
              const run = raw as AgentRun;
              if (!byRunId.has(run.id)) {
                byRunId.set(run.id, {
                  run: {
                    ...run,
                    agentId: run.agentId || a.id,
                    userId: run.userId || uid,
                  },
                  agentId: a.id,
                  agentName: a.name,
                });
              }
            }
          } catch {
            /* skip agent */
          }
        })
      );
    }

    const list = Array.from(byRunId.values()).sort((a, b) => {
      const ta = Date.parse(a.run.startedAt || "") || 0;
      const tb = Date.parse(b.run.startedAt || "") || 0;
      return tb - ta;
    });

    setItems(list);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const rejectRun = async (run: AgentRun) => {
    if (busyId) return;
    setBusyId(run.id);
    setActionError("");
    try {
      updateAgentRun(run.id, {
        status: "cancelled",
        finishedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        summary: "You rejected this step. Work was stopped.",
        pendingStepId: undefined,
        pendingStepIndex: undefined,
      } as any);
      await load();
    } catch (e: any) {
      setActionError(e?.message || "Could not reject this run.");
    }
    setBusyId(null);
  };

  const approveRun = async (run: AgentRun, agentId: string) => {
    if (busyId) return;
    setBusyId(run.id);
    setActionError("");
    try {
      const s = loadOperatorState();
      const uid = s.user?.id || "";
      const agent = getAgent(agentId) || agents.find((a) => a.id === agentId);
      if (!agent) {
        setActionError("Employee not found. Open AI Team and try again.");
        setBusyId(null);
        return;
      }
      const steps = toWorkflowSteps(agent);
      if (!steps.length) {
        setActionError("This employee has no steps to continue.");
        setBusyId(null);
        return;
      }

      const pendingId =
        run.pendingStepId ||
        (run.steps || run.stepResults || []).find(
          (st: any) => st.status === "awaiting_approval"
        )?.stepId;
      const pendingIndex =
        typeof run.pendingStepIndex === "number"
          ? run.pendingStepIndex
          : steps.findIndex((st) => st.id === pendingId);

      const startIndex = pendingIndex >= 0 ? pendingIndex : 0;
      const approvalStepId =
        pendingId || steps[startIndex]?.id || steps[0]?.id;

      updateAgentRun(run.id, {
        status: "running",
        summary: "Resuming after your approval…",
      } as any);

      const parent = getNotionParent() || undefined;
      const priorResults = (run.steps || run.stepResults || []) as any[];
      const priorContext =
        (run.contextSnapshot || run.context || (run as any).outputs) as any;

      const result = await runWorkflow({
        steps,
        startIndex,
        approvalGrantedForStepId: approvalStepId,
        priorResults: Array.isArray(priorResults)
          ? priorResults.filter(
              (r) => r && r.status !== "awaiting_approval"
            )
          : [],
        priorContext: priorContext || undefined,
        connections: {
          userId: uid,
          notionDefaultParent: parent,
          origin:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      const status = mapWorkflowResultToRunStatus(result);
      const summary =
        result.output ||
        result.error ||
        (status === "succeeded"
          ? "Work completed after approval."
          : status === "waiting_for_approval"
            ? "Still waiting for another approval."
            : "Work finished with issues.");

      updateAgentRun(run.id, {
        status,
        finishedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        summary,
        error: result.error || undefined,
        steps: result.steps as any,
        stepResults: result.steps as any,
        contextSnapshot: result.context as any,
        context: result.context as any,
        pendingStepId: result.pendingStepId,
        pendingStepIndex: result.pendingStepIndex,
      } as any);

      if (!result.ok && result.error) {
        setActionError(result.error);
      }
      await load();
    } catch (e: any) {
      updateAgentRun(run.id, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        summary: "Failed after approval",
        error: e?.message || String(e),
      } as any);
      setActionError(e?.message || "Could not continue this run.");
      await load();
    }
    setBusyId(null);
  };

  const filtered = useMemo(
    () => items.filter((it) => matchesFilter(String(it.run.status), filter)),
    [items, filter]
  );

  const counts = useMemo(() => {
    const c = { all: items.length, running: 0, waiting: 0, succeeded: 0, failed: 0 };
    for (const it of items) {
      const s = normalizeStatus(String(it.run.status));
      if (s === "running" || s === "queued") c.running++;
      else if (isWaiting(s)) c.waiting++;
      else if (
        s === "succeeded" ||
        s === "completed" ||
        s === "succeeded_with_errors" ||
        s === "partial"
      )
        c.succeeded++;
      else if (s === "failed" || s === "cancelled") c.failed++;
    }
    return c;
  }, [items]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "running", label: `In progress (${counts.running})` },
    { key: "waiting", label: `Needs you (${counts.waiting})` },
    { key: "succeeded", label: `Done (${counts.succeeded})` },
    { key: "failed", label: `Failed (${counts.failed})` },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <PageHeader
          page="activity"
          title="Work Board"
          subtitle="Live results from your AI employees — running, needs approval, done, or failed. This is where completed work shows up after you start a run."
          actions={
            <Link
              href="/agents"
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              AI team
            </Link>
          }
        />

        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {actionError}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.key
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading work…</p>
        ) : agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-600">No employees yet — hire one first, then start work.</p>
            <Link href="/agents/new" className="mt-2 inline-block text-sm text-indigo-600">
              Open Hiring Desk →
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-600">
              {items.length === 0
                ? "No runs yet. Open an employee and press Start work — results land here."
                : "No items in this filter."}
            </p>
            {items.length === 0 && (
              <Link href="/agents" className="mt-2 inline-block text-sm text-indigo-600">
                Go to AI team →
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map(({ run, agentName, agentId }) => {
              const waiting = isWaiting(String(run.status));
              return (
                <li
                  key={run.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/agents/${agentId}`}
                        className="truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {agentName}
                      </Link>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {run.trigger === "schedule" ? "Scheduled" : "Manual"}
                        {run.startedAt
                          ? ` · ${new Date(run.startedAt).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                    <span className={statusBadgeClass(String(run.status))}>
                      {runStatusLabel(String(run.status))}
                    </span>
                  </div>
                  {run.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {run.summary}
                    </p>
                  )}
                  {run.error && (
                    <p className="mt-1 line-clamp-2 text-xs text-red-600 dark:text-red-400">
                      {run.error}
                    </p>
                  )}
                  {waiting && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === run.id}
                        onClick={() => void approveRun(run, agentId)}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {busyId === run.id ? "Working…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === run.id}
                        onClick={() => void rejectRun(run)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Reject
                      </button>
                      <Link
                        href={`/agents/${agentId}`}
                        className="rounded-lg px-3 py-1.5 text-sm text-indigo-600 hover:underline"
                      >
                        Open employee
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
