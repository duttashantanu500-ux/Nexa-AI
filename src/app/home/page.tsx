"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import { Agent, AgentRun } from "@/types";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setName(s.user.name || "");
    setAgents(s.agents.filter((a) => a.userId === s.user!.id));
    setRuns(s.agentRuns.filter((r) => r.userId === s.user!.id).slice(0, 5));
  }, [router]);

  const active = agents.filter((a) => a.status === "active");
  const upcoming = agents
    .filter((a) => a.schedule?.enabled && a.schedule.nextRunAt)
    .sort((a, b) =>
      (a.schedule.nextRunAt || "") > (b.schedule.nextRunAt || "") ? 1 : -1
    )
    .slice(0, 5);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}
            {name ? `, ${name}` : ""}.
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Create agents, connect tools, set a schedule, and let Nexa run the
            work.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/agents/new"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Create agent
          </Link>
          <Link
            href="/agents"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            View agents
          </Link>
        </div>

        {agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium">No agents yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Create your first agent to automate a task on your schedule.
            </p>
            <Link
              href="/agents/new"
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
            >
              Create agent
            </Link>
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Your agents ({agents.length})
                </h2>
                <span className="text-xs text-zinc-500">
                  {active.length} active
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {agents.slice(0, 4).map((a) => (
                  <Link
                    key={a.id}
                    href={`/agents/${a.id}`}
                    className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{a.name}</div>
                      <StatusPill status={a.status} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                      {a.purpose || a.description}
                    </p>
                    {a.schedule?.frequency !== "once" && a.schedule?.nextRunAt && (
                      <p className="mt-2 text-[11px] text-zinc-400">
                        Next: {new Date(a.schedule.nextRunAt).toLocaleString()}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>

            {upcoming.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Upcoming runs
                </h2>
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                  {upcoming.map((a) => (
                    <li key={a.id} className="flex justify-between px-4 py-3 text-sm">
                      <span>{a.name}</span>
                      <span className="text-xs text-zinc-500">
                        {a.schedule.frequency} ·{" "}
                        {a.schedule.nextRunAt
                          ? new Date(a.schedule.nextRunAt).toLocaleString()
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {runs.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Recent runs
                </h2>
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                  {runs.map((r) => {
                    const agent = agents.find((a) => a.id === r.agentId);
                    return (
                      <li key={r.id} className="px-4 py-3 text-sm">
                        <div className="flex justify-between">
                          <Link
                            href={`/agents/${r.agentId}`}
                            className="font-medium hover:text-indigo-600"
                          >
                            {agent?.name || "Agent"}
                          </Link>
                          <span className="text-xs capitalize text-zinc-500">
                            {r.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {new Date(r.startedAt).toLocaleString()}
                          {r.summary ? ` · ${r.summary.slice(0, 80)}` : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "paused"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${styles}`}>
      {status}
    </span>
  );
}
