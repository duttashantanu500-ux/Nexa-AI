"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { loadOperatorState, saveOperatorState } from "@/lib/operatorStore";
import { fetchServerAgents } from "@/lib/serverAgentClient";
import { authHeaders } from "@/lib/authHeaders";
import {
  runStatusLabel,
  statusBadgeClass,
} from "@/lib/runLifecycle";
import type { Agent, AgentRun } from "@/types";

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

function matchesFilter(status: string, filter: FilterKey): boolean {
  const s = normalizeStatus(status);
  if (filter === "all") return true;
  if (filter === "running") return s === "running" || s === "queued";
  if (filter === "waiting")
    return s === "waiting_for_approval" || s === "waiting_approval";
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

export default function WorkBoardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
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

    // Local runs (primary source used by employee detail)
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

    // Merge server runs when available (soft-fail)
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

  const filtered = useMemo(
    () => items.filter((it) => matchesFilter(String(it.run.status), filter)),
    [items, filter]
  );

  const counts = useMemo(() => {
    const c = { all: items.length, running: 0, waiting: 0, succeeded: 0, failed: 0 };
    for (const it of items) {
      const s = normalizeStatus(String(it.run.status));
      if (s === "running" || s === "queued") c.running++;
      else if (s === "waiting_for_approval" || s === "waiting_approval") c.waiting++;
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
          subtitle="Real work across your digital team — status only updates when execution succeeds or fails."
          actions={
            <Link
              href="/agents"
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              Digital team
            </Link>
          }
        />

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
            <p className="text-sm text-zinc-600">No employees yet — hire a role first.</p>
            <Link href="/agents/new" className="mt-2 inline-block text-sm text-indigo-600">
              Open Hiring Desk →
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-600">
              {items.length === 0
                ? "No work recorded yet. Open an employee and start work."
                : "No items in this filter."}
            </p>
            {items.length === 0 && (
              <Link href="/agents" className="mt-2 inline-block text-sm text-indigo-600">
                Go to digital team →
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map(({ run, agentName, agentId }) => (
              <li key={run.id}>
                <Link
                  href={`/agents/${agentId}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {agentName}
                      </div>
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
