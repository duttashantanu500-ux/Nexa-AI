"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import { listDueAgents } from "@/lib/clientScheduler";
import { statusBadgeClass } from "@/lib/runLifecycle";
import type { Agent } from "@/types";

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setAgents(s.agents);
    setDueCount(listDueAgents().length);
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Agents</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Workflow agents across your connected tools.
            </p>
          </div>
          <Link
            href="/agents/new"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          >
            Create agent
          </Link>
        </div>

        {dueCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {dueCount} schedule{dueCount === 1 ? "" : "s"} due while this app is open. Open the
            agent and use Run now (browser cannot run schedules after the tab closes).
          </div>
        )}

        {agents.some((a) => (a.schedule?.consecutiveFailures || 0) >= 3) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            One or more agents have failed their schedule 3+ times. Check Connections and recent run
            history.
          </div>
        )}

        {agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 p-10 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-500">No agents yet.</p>
            <Link href="/agents/new" className="mt-3 inline-block text-sm text-indigo-600">
              Create your first agent
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {agents.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/agents/${a.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{a.name}</div>
                    <p className="text-xs text-zinc-500">
                      {a.steps?.length || 0} steps · {a.schedule.frequency}
                      {a.schedule.nextRunAt
                        ? ` · next ${new Date(a.schedule.nextRunAt).toLocaleString()}`
                        : ""}
                      {(a.schedule?.consecutiveFailures || 0) >= 3
                        ? ` · ${a.schedule.consecutiveFailures} schedule failures`
                        : ""}
                    </p>
                  </div>
                  <span className={statusBadgeClass(String(a.status))}>
                    {String(a.status).replace(/_/g, " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
