"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState, saveOperatorState, deleteAgent } from "@/lib/operatorStore";
import { fetchServerAgents, deleteServerAgent } from "@/lib/serverAgentClient";
import { listDueAgents } from "@/lib/clientScheduler";
import { statusBadgeClass } from "@/lib/runLifecycle";
import type { Agent } from "@/types";

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [busyId, setBusyId] = useState("");

  const refresh = async () => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    const uid = s.user?.id || "";
    let local = (s.agents || []).filter((a) => String(a.status) !== "archived");
    if (uid) {
      const matched = local.filter((a) => !a.userId || a.userId === uid);
      if (matched.length > 0) local = matched;
    }
    setAgents(local);
    setDueCount(listDueAgents().length);

    try {
      const remote = await fetchServerAgents();
      if (!remote.ok) return;
      const byId = new Map<string, Agent>();
      for (const a of local) byId.set(a.id, a);
      for (const r of remote.agents || []) {
        if (!r?.id) continue;
        const prev = byId.get(r.id);
        byId.set(r.id, {
          ...(prev || ({} as Agent)),
          id: r.id,
          userId: uid || prev?.userId || "",
          name: r.name || prev?.name || "AI Employee",
          description: r.description || prev?.description || "",
          purpose: r.purpose || r.description || prev?.purpose || "",
          status: r.status || prev?.status || "active",
          version: r.version || prev?.version || 1,
          steps: Array.isArray(r.steps) && r.steps.length ? r.steps : prev?.steps || [],
          schedule: prev?.schedule || { frequency: "once", enabled: false },
          tools: prev?.tools || [],
          permissions: prev?.permissions,
          lastRunAt: prev?.lastRunAt ?? null,
          lastRunStatus: prev?.lastRunStatus ?? null,
          createdAt: r.createdAt || prev?.createdAt || new Date().toISOString(),
          updatedAt: r.updatedAt || prev?.updatedAt || new Date().toISOString(),
        } as Agent);
      }
      const merged = Array.from(byId.values()).filter((a) => String(a.status) !== "archived");
      const st = loadOperatorState();
      st.agents = merged;
      saveOperatorState(st);
      setAgents(merged);
    } catch {
      /* keep local */
    }
  };

  useEffect(() => {
    void refresh();
  }, [router]);

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this AI employee? This cannot be undone.")) return;
    setBusyId(id);
    try {
      deleteAgent(id);
      await deleteServerAgent(id);
      await refresh();
    } finally {
      setBusyId("");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Your AI Team</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Your AI employees — each with a role, tools, and schedule.
            </p>
          </div>
          <Link
            href="/agents/new"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          >
            Hire AI Employee
          </Link>
        </div>

        {dueCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {dueCount} schedule{dueCount === 1 ? "" : "s"} due while this app is open.
          </div>
        )}

        {agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 p-10 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-500">No AI employees yet.</p>
            <Link href="/agents/new" className="mt-3 inline-block text-sm text-indigo-600">
              Hire your first AI employee
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {agents.map((a) => (
              <li key={a.id}>
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <Link href={`/agents/${a.id}`} className="min-w-0 flex-1 hover:opacity-90">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{a.name}</div>
                    <p className="text-xs text-zinc-500">
                      {a.steps?.length || 0} steps · {a.schedule?.frequency || "once"}
                    </p>
                  </Link>
                  <span className={statusBadgeClass(String(a.status))}>
                    {String(a.status).replace(/_/g, " ")}
                  </span>
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={(e) => void onDelete(a.id, e)}
                    className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
