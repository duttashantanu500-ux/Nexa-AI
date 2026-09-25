"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import { CONNECTOR_REGISTRY } from "@/lib/connectors/registry";
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
  const [oauthConfigured, setOauthConfigured] = useState<string[]>([]);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setName(s.user.name || "");
    setAgents(s.agents.filter((a) => a.userId === s.user!.id));
    setRuns(s.agentRuns.filter((r) => r.userId === s.user!.id).slice(0, 8));

    fetch("/api/oauth/status")
      .then((r) => r.json())
      .then((d) => {
        const list: string[] = [];
        if (d?.providers?.slack?.configured) list.push("Slack");
        if (d?.providers?.notion?.configured) list.push("Notion");
        if (d?.providers?.github?.configured) list.push("GitHub");
        if (d?.providers?.google?.configured) list.push("Google");
        setOauthConfigured(list);
      })
      .catch(() => {});
  }, [router]);

  const active = agents.filter((a) => a.status === "active" || a.status === "ready");
  const failedRuns = runs.filter((r) => r.status === "failed");
  const priority = CONNECTOR_REGISTRY.filter((c) =>
    ["slack", "notion", "github", "local_data"].includes(c.id)
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}
            {name ? `, ${name}` : ""}.
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Connect your services. Build workflows. Nexa bridges the gap between them.
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
            href="/connections"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            Manage connections
          </Link>
        </div>

        {/* Connection overview */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Services
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {priority.map((c) => {
              const ready =
                c.id === "local_data" ||
                oauthConfigured.some((x) => x.toLowerCase() === c.provider);
              return (
                <Link
                  key={c.id}
                  href="/connections"
                  className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span
                      className={`text-[10px] font-medium ${
                        ready ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {ready ? "Ready / local" : "Setup required"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{c.description}</p>
                </Link>
              );
            })}
          </div>
          {oauthConfigured.length === 0 && (
            <p className="text-xs text-zinc-500">
              Slack, Notion, and GitHub need OAuth credentials from the Nexa admin before Connect works. Local data tools work now.
            </p>
          )}
        </section>

        {/* Agents */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Agents ({agents.length})
            </h2>
            <span className="text-xs text-zinc-500">{active.length} active</span>
          </div>
          {agents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-600">No workflow agents yet.</p>
              <Link href="/agents/new" className="mt-2 inline-block text-sm text-indigo-600">
                Create from available connectors →
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  href={`/agents/${a.id}`}
                  className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="font-medium">{a.name}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                    {a.purpose || a.description || `${a.steps?.length || 0} steps`}
                  </p>
                  <p className="mt-2 text-[11px] capitalize text-zinc-400">{a.status}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent runs + failures */}
        {runs.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Recent runs
              {failedRuns.length > 0 && (
                <span className="ml-2 text-xs font-normal text-red-600">
                  {failedRuns.length} failed
                </span>
              )}
            </h2>
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {runs.map((r) => {
                const agent = agents.find((a) => a.id === r.agentId);
                return (
                  <li key={r.id} className="px-4 py-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <Link href={`/agents/${r.agentId}`} className="font-medium hover:text-indigo-600">
                        {agent?.name || "Agent"}
                      </Link>
                      <span
                        className={`text-xs capitalize ${
                          r.status === "failed" ? "text-red-600" : "text-zinc-500"
                        }`}
                      >
                        {r.status}
                        {r.mode === "simulated" ? " · simulated" : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {new Date(r.startedAt).toLocaleString()}
                      {r.error ? ` · ${r.error.slice(0, 80)}` : r.summary ? ` · ${r.summary.slice(0, 80)}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
