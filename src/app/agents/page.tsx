"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import { Agent, AGENT_TEMPLATES } from "@/types";

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setAgents(s.agents.filter((a) => a.userId === s.user!.id));
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Create agents, pick tools, set schedules, and review runs.
            </p>
          </div>
          <Link
            href="/agents/new"
            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
          >
            Create agent
          </Link>
        </div>

        {agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No agents configured yet.
            </p>
            <Link
              href="/agents/new"
              className="mt-3 inline-block text-sm font-medium text-indigo-600"
            >
              Create your first agent →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((a) => (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <p className="mt-1 text-sm text-zinc-500 line-clamp-2">
                      {a.purpose || a.description}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                      a.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : a.status === "paused"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                  <span className="capitalize">{a.schedule.frequency}</span>
                  <span>·</span>
                  <span>{a.tools.length} tools</span>
                  {a.lastRunAt && (
                    <>
                      <span>·</span>
                      <span>
                        Last run {new Date(a.lastRunAt).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Templates
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {AGENT_TEMPLATES.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="font-medium">{t.name}</div>
                <p className="mt-1 text-xs text-zinc-500">{t.description}</p>
                {!t.executable && (
                  <p className="mt-2 text-[11px] text-amber-600">
                    Requires a connection that is not available yet
                  </p>
                )}
                {t.executable && (
                  <Link
                    href={`/agents/new?template=${t.id}`}
                    className="mt-3 inline-block text-xs font-medium text-indigo-600"
                  >
                    Use template →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
