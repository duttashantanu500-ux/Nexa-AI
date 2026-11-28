"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { loadOperatorState, saveOperatorState } from "@/lib/operatorStore";
import { fetchServerAgents } from "@/lib/serverAgentClient";
import { Agent, AgentRun, defaultPermissions } from "@/types";
import { WorkforceChat } from "@/components/WorkforceChat";

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
      if (!s.user) {
        router.replace("/login");
        return;
      }
      if (!s.user.onboardingCompleted) {
        router.replace("/onboarding");
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
        <PageHeader
          page="home"
          title={`${greeting()}${name ? `, ${name}` : ""}.`}
          subtitle="Hire AI employees. Connect apps. Get real work done."
          actions={
            <>
              <Link
                href="/agents/new"
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500"
              >
                Hire employee
              </Link>
              <Link
                href="/connections"
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                Connections
              </Link>
            </>
          }
        />

        <WorkforceChat
          agentNames={agents.map((a) => a.name).filter(Boolean)}
          agentIdsByName={Object.fromEntries(
            agents.filter((a) => a.name && a.id).map((a) => [a.name, a.id])
          )}
          recentRunCount={runs.length}
          failedRunCount={failedRuns.length}
        />

        <section className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/agents/new"
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Hire</div>
            <p className="mt-1 text-xs text-zinc-500">Create an AI employee for real work</p>
          </Link>
          <Link
            href="/connections"
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Connect</div>
            <p className="mt-1 text-xs text-zinc-500">Link Gmail, Slack, Notion, and more</p>
          </Link>
          <Link
            href="/activity"
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Work Board</div>
            <p className="mt-1 text-xs text-zinc-500">See runs, results, and issues</p>
          </Link>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              AI team ({agents.length})
            </h2>
            <span className="text-xs text-zinc-500">{active.length} active</span>
          </div>
          {agents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                No AI employees yet
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Hire one for research, marketing, sales, or ops — with real app access.
              </p>
              <Link
                href="/agents/new"
                className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Open Hiring Desk
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.slice(0, 6).map((a) => (
                <Link
                  key={a.id}
                  href={`/agents/${a.id}`}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">{a.name}</div>
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
