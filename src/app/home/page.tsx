"use client";

import { useEffect, useState } from "react";
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

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [goal, setGoal] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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
    setMissions(s.missions || []);
    ensureDefaultAgents(s.user.id);
  }, [router]);

  const handleCreate = async () => {
    if (!user || !goal.trim() || creating) return;
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

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greet}, {user.name}.
          </h1>
          <p className="mt-1 text-sm text-muted">What do you want Nexa to get done?</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-black/5">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Research potential customers for my product…"
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
              {creating ? (
                <span className="animate-pulse-soft">Planning…</span>
              ) : (
                "Create Mission"
              )}
            </button>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Active missions</h2>
            <Link href="/missions" className="text-xs text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {missions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
              No missions yet. Tell Nexa what you want done above.
            </div>
          ) : (
            <div className="space-y-2">
              {missions.slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  href={`/missions/${m.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:border-indigo-200 hover:shadow-sm transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.title}</div>
                    <div className="text-xs text-muted truncate">{m.goal}</div>
                  </div>
                  <MissionBadge status={m.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
