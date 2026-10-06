"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState, saveOperatorState } from "@/lib/operatorStore";
import { fetchServerAgents } from "@/lib/serverAgentClient";
import { CONNECTOR_REGISTRY } from "@/lib/connectors/registry";
import { Agent, AgentRun, defaultPermissions } from "@/types";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function mergeAgents(local: Agent[], remote: any[], userId: string): Agent[] {
  const byId = new Map<string, Agent>();
  for (const a of local) {
    if (!a?.id) continue;
    byId.set(a.id, { ...a, userId: a.userId || userId });
  }
  for (const r of remote) {
    if (!r?.id) continue;
    const existing = byId.get(r.id);
    if (existing) {
      byId.set(r.id, {
        ...existing,
        name: r.name || existing.name,
        description: r.description || existing.description,
        purpose: r.purpose || existing.purpose || r.description || "",
        status: r.status || existing.status,
        steps: Array.isArray(r.steps) && r.steps.length ? r.steps : existing.steps,
        userId,
      });
    } else {
      byId.set(r.id, {
        id: r.id,
        userId,
        name: r.name || "AI Employee",
        description: r.description || "",
        purpose: r.purpose || r.description || "",
        instructions: "",
        expectedOutput: "",
        constraints: "",
        status: r.status || "active",
        version: r.version || 1,
        tools: [],
        steps: Array.isArray(r.steps) ? r.steps : [],
        permissions: defaultPermissions(),
        schedule: r.schedule || { frequency: "once", enabled: false },
        lastRunAt: null,
        lastRunStatus: null,
        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: r.updatedAt || new Date().toISOString(),
      } as Agent);
    }
  }
  return Array.from(byId.values()).filter((a) => String(a.status) !== "archived");
}

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const s = loadOperatorState();
      if (!s.user?.onboardingCompleted) {
        router.replace("/signup");
        return;
      }
      const uid = s.user.id || "";
      setName(s.user.name || "");

      let localAgents = (s.agents || []).filter((a) => {
        if (String(a.status) === "archived") return false;
        if (!a.userId || !uid) return true;
        return a.userId === uid;
      });
      if (localAgents.length === 0 && (s.agents || []).length > 0) {
        localAgents = (s.agents || []).filter((a) => String(a.status) !== "archived");
      }
      if (!cancelled) {
        setAgents(localAgents);
        setRuns((s.agentRuns || []).filter((r) => !uid || r.userId === uid).slice(0, 8));
        setReady(true);
      }

      try {
        const remote = await fetchServerAgents();
        if (cancelled || !remote.ok) return;
        const merged = mergeAgents(localAgents, remote.agents || [], uid);
        const st = loadOperatorState();
        st.agents = merged;
        saveOperatorState(st);
        if (!cancelled) setAgents(merged);
      } catch {
        /* keep local */
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const active = agents.filter((a) => a.status === "active" || a.status === "ready");
  const failedRuns = runs.filter((r) => r.status === "failed");
  const priority = CONNECTOR_REGISTRY.filter((c) =>
    ["slack", "notion", "github", "local_data"].includes(c.id)
  );

  if (!ready) {
    return (
      <AppShell>
        <div className="px-4 py-16 text-center text-sm text-zinc-500">Loading…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}
            {name ? `, ${name}` : ""}.
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Connect your tools. Build your AI team. Let them handle the work.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/agents/new"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Hire AI Employee
          </Link>
          <Link
            href="/connections"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            Manage connections
          </Link>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Services</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {priority.map((c) => (
              <Link
                key={c.id}
                href={`/connections/${c.id}`}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-[10px] font-medium text-zinc-500">Open</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{c.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              AI Team ({agents.length})
            </h2>
            <span className="text-xs text-zinc-500">{active.length} active</span>
          </div>
          {agents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-600">No AI employees yet.</p>
              <Link href="/agents/new" className="mt-2 inline-block text-sm text-indigo-600">
                Hire an AI employee →
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

        {failedRuns.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Needs attention
            </h2>
            <p className="text-xs text-zinc-500">
              {failedRuns.length} recent run{failedRuns.length === 1 ? "" : "s"} failed. Open the
              employee to review work history.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
