"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
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
    setAgents(s.agents.filter((a) => a.userId === s.user!.id));
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Agents</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Workflow agents with explicit steps — no chat required.
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
            <p className="text-sm text-zinc-600">No agents yet.</p>
            <Link href="/agents/new" className="mt-3 inline-block text-sm font-medium text-indigo-600">
              Create your first workflow →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((a) => (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                      {a.purpose || a.description || `${a.steps?.length || 0} steps`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium capitalize text-zinc-600">
                    {String(a.status).replace("_", " ")}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-zinc-400">
                  {a.steps?.length || 0} steps · {a.schedule.frequency}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
