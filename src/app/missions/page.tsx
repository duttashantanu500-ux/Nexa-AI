"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MissionBadge } from "@/components/StatusBadge";
import { loadOperatorState, createMission } from "@/lib/operatorStore";
import { Mission, UserProfile } from "@/types";

export default function MissionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [goal, setGoal] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace(s.user ? "/onboarding" : "/signup");
      return;
    }
    setUser(s.user);
    setMissions(s.missions || []);
  }, [router]);

  const create = () => {
    if (!user || !goal.trim()) return;
    const m = createMission(user.id, goal.trim());
    setGoal("");
    setOpen(false);
    router.push(`/missions/${m.id}`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Missions</h1>
            <p className="text-sm text-muted">Work Nexa is doing for your business</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            New Mission
          </button>
        </div>

        {open && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <label className="text-sm font-medium">What do you want Nexa to accomplish?</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              placeholder="Find 30 potential customers and prepare personalized outreach."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button
                onClick={create}
                disabled={!goal.trim()}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Start Mission
              </button>
            </div>
          </div>
        )}

        {missions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
            No missions yet. Create one to put Nexa to work.
          </div>
        ) : (
          <div className="space-y-2">
            {missions.map((m) => (
              <Link
                key={m.id}
                href={`/missions/${m.id}`}
                className="block rounded-xl border border-border bg-card px-4 py-3 hover:bg-sidebar transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{m.title}</div>
                    <div className="text-xs text-muted mt-0.5 line-clamp-2">{m.goal}</div>
                    <div className="text-[11px] text-muted mt-2">
                      Updated {new Date(m.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <MissionBadge status={m.status} />
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all"
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
