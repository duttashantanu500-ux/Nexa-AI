"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AgentBadge } from "@/components/StatusBadge";
import { loadOperatorState, ensureDefaultAgents } from "@/lib/operatorStore";
import { Agent } from "@/types";

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setAgents(ensureDefaultAgents(s.user.id));
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
            <p className="text-sm text-muted">
              Templates for specialized work. Full autonomy ships later.
            </p>
          </div>
          <Link
            href="/agents/new"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Create agent
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm">{a.name}</div>
                <AgentBadge status={a.status} />
              </div>
              <p className="text-sm text-muted">{a.purpose}</p>
              <div className="text-xs text-muted">
                Tools: {a.tools.join(", ") || "None"}
              </div>
              <div className="text-xs text-muted">Schedule: {a.schedule || "On demand"}</div>
              <div className="text-xs text-muted">{a.recentActivity}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
