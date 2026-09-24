"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MissionBadge } from "@/components/StatusBadge";
import { loadOperatorState, createMission, friendlyError } from "@/lib/operatorStore";
import { Mission, UserProfile } from "@/types";

function dedupeById(list: Mission[]): Mission[] {
  const map = new Map<string, Mission>();
  for (const m of list) {
    const prev = map.get(m.id);
    if (!prev || new Date(m.updatedAt) > new Date(prev.updatedAt)) map.set(m.id, m);
  }
  return [...map.values()].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
  );
}

export default function MissionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [goal, setGoal] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace(s.user ? "/onboarding" : "/signup");
      return;
    }
    setUser(s.user);
    setMissions(dedupeById(s.missions || []));
  }, [router]);

  const create = async () => {
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
      if (!res.ok || !data.plan) throw new Error(data.error || "Plan failed");
      const plan = data.plan;
      const m = createMission(user.id, goal.trim(), {
        title: plan.title,
        steps: plan.steps,
        researchQuery: plan.researchQuery,
      });
      setGoal("");
      setOpen(false);
      router.push(`/missions/${m.id}`);
    } catch (e: any) {
      setError(friendlyError(e?.message));
      lock.current = false;
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Missions</h1>
            <p className="text-sm text-muted">Work Nexa is doing for you</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            New Mission
          </button>
        </div>

        {open && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <label className="text-sm font-medium">What should Nexa research or do?</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              placeholder="Find 10 restaurants in Lucknow"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={create}
                disabled={!goal.trim() || creating}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
              >
                {creating ? "Planning…" : "Create Mission"}
              </button>
            </div>
          </div>
        )}

        {missions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
            No missions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {missions.map((m) => (
              <Link
                key={m.id}
                href={`/missions/${m.id}`}
                className="block rounded-xl border border-border bg-card px-4 py-3 hover:border-indigo-200 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-medium">{m.title}</div>
                    {m.goal !== m.title && (
                      <div className="text-xs text-muted">
                        <span className="text-muted/80">Command: </span>
                        {m.goal}
                      </div>
                    )}
                    <div className="text-[11px] text-muted">
                      Created {new Date(m.createdAt).toLocaleString()} · Updated{" "}
                      {new Date(m.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <MissionBadge status={m.status} />
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all"
                    style={{ width: `${m.progress}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
