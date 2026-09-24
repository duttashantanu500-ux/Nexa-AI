"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState, ensureDefaultAgents } from "@/lib/operatorStore";
import { Agent } from "@/types";

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace(s.user ? "/onboarding" : "/signup");
      return;
    }
    const list = ensureDefaultAgents(s.user.id);
    setAgents(list);
    setLoaded(true);
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
            <p className="text-sm text-muted mt-1">
              Templates and custom agents. Persisted locally; run work via Missions.
            </p>
          </div>
          <Link
            href="/agents/new"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Create agent
          </Link>
        </div>

        {!loaded ? (
          <div className="text-sm text-muted">Loading…</div>
        ) : agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
            No agents yet. Create one to define a reusable objective.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {agents.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{a.name}</div>
                  {a.isTemplate && (
                    <span className="text-[11px] text-muted">Template</span>
                  )}
                </div>
                <p className="text-xs text-muted leading-relaxed">{a.purpose}</p>
                <p className="text-[11px] text-muted">
                  Tools: {a.tools?.length ? a.tools.join(", ") : "none"}
                </p>
                <p className="text-[11px] text-muted">
                  {a.recentActivity || "Idle — start a Mission to use this agent"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
