"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { MissionBadge } from "@/components/StatusBadge";
import {
  loadOperatorState,
  createMission,
  ensureDefaultAgents,
} from "@/lib/operatorStore";
import { Mission, UserProfile } from "@/types";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [goal, setGoal] = useState("");
  const [creating, setCreating] = useState(false);

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

  const handleCreate = () => {
    if (!user || !goal.trim() || creating) return;
    setCreating(true);
    const m = createMission(user.id, goal.trim());
    setGoal("");
    setCreating(false);
    router.push(`/missions/${m.id}`);
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
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greet}, {user.name}.
          </h1>
          <p className="mt-1 text-sm text-muted">What do you want Nexa to get done?</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Find 20 potential customers for my SaaS…"
            rows={3}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleCreate}
              disabled={!goal.trim() || creating}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {creating ? "Creating…" : "Create Mission"}
            </button>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Active missions</h2>
            <Link href="/missions" className="text-xs text-muted hover:text-foreground">
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
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:bg-sidebar transition"
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
