"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { MissionBadge } from "@/components/StatusBadge";
import {
  loadOperatorState,
  createMission,
  ensureDefaultAgents,
  friendlyError,
} from "@/lib/operatorStore";
import { Mission, UserProfile } from "@/types";
import Link from "next/link";

const ACTIVE = new Set(["planning", "ready", "running", "paused", "waiting_approval"]);
const DONE = new Set(["completed", "failed", "cancelled"]);

function dedupeMissions(list: Mission[]): Mission[] {
  const byId = new Map<string, Mission>();
  for (const m of list) {
    const prev = byId.get(m.id);
    if (!prev || new Date(m.updatedAt) > new Date(prev.updatedAt)) {
      byId.set(m.id, m);
    }
  }
  // Also collapse identical title+goal created within same second (double-click)
  const out: Mission[] = [];
  const seenKey = new Set<string>();
  for (const m of [...byId.values()].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
  )) {
    const key = `${m.title}|${m.goal}|${m.status}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    out.push(m);
  }
  return out;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [goal, setGoal] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user) {
      router.replace("/signup");
      return;
    }
    if (!s.user.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
    setUser(s.user);
    setMissions(dedupeMissions(s.missions || []));
    ensureDefaultAgents(s.user.id);
  }, [router]);

  const handleCreate = async () => {
    if (!user || !goal.trim() || creating || lock.current) return;
    lock.current = true;
    setCreating(true);
    setError("");

    try {
      const businessContext = loadOperatorState().businessContext;
      const res = await fetch("/api/missions/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), businessContext }),
      });
      const data = await res.json();
      if (!res.ok || !data.plan) {
        throw new Error(data.error || "Could not create plan");
      }

      const m = createMission(user.id, goal.trim(), {
        title: data.plan.title,
        steps: data.plan.steps,
        researchQuery: data.plan.researchQuery,
      });
      setGoal("");
      router.push(`/missions/${m.id}`);
    } catch (e: any) {
      setError(friendlyError(e?.message));
      lock.current = false;
    } finally {
      setCreating(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  const hour = new Date().getHours();
  const greet =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const active = missions.filter((m) => ACTIVE.has(m.status));
  const completed = missions.filter((m) => m.status === "completed").slice(0, 5);
  const failed = missions.filter((m) => m.status === "failed").slice(0, 3);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greet}, {user.name}.
          </h1>
          <p className="mt-1 text-sm text-muted">What do you want Nexa to get done?</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Find 20 restaurants in Lucknow…"
            rows={3}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreate();
            }}
          />
          <div className="mt-3 flex justify-end gap-2 items-center">
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button
              onClick={handleCreate}
              disabled={!goal.trim() || creating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {creating ? "Planning…" : "Create Mission"}
            </button>
          </div>
        </div>

        <MissionSection title="Active" items={active} empty="No active missions." />
        <MissionSection title="Completed" items={completed} empty={null} />
        <MissionSection title="Failed" items={failed} empty={null} />
      </div>
    </AppShell>
  );
}

function MissionSection({
  title,
  items,
  empty,
}: {
  title: string;
  items: Mission[];
  empty: string | null;
}) {
  if (items.length === 0 && !empty) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        {title === "Active" && (
          <Link href="/missions" className="text-xs text-indigo-600 hover:underline">
            View all
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <Link
              key={m.id}
              href={`/missions/${m.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:border-indigo-200 hover:shadow-sm transition"
            >
              <div className="min-w-0 pr-3">
                <div className="text-sm font-medium truncate">{m.title}</div>
                {m.goal !== m.title && (
                  <div className="text-xs text-muted truncate mt-0.5">{m.goal}</div>
                )}
              </div>
              <MissionBadge status={m.status} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
