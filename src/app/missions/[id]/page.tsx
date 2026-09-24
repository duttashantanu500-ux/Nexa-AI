"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MissionBadge } from "@/components/StatusBadge";
import {
  getMission,
  setMissionStatus,
  createApproval,
  loadOperatorState,
} from "@/lib/operatorStore";
import { Mission } from "@/types";
import { ArrowLeft } from "lucide-react";

export default function MissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [mission, setMission] = useState<Mission | null>(null);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    const m = getMission(id);
    if (!m) {
      router.replace("/missions");
      return;
    }
    setMission(m);
  }, [id, router]);

  if (!mission) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-muted">Loading mission…</div>
      </AppShell>
    );
  }

  const markWaiting = () => {
    const user = loadOperatorState().user;
    if (!user) return;
    const updated = setMissionStatus(mission.id, "waiting_approval");
    createApproval(
      user.id,
      "Review mission output",
      `Nexa prepared a draft result for: ${mission.title}`,
      mission.id
    );
    if (updated) setMission(updated);
  };

  const markComplete = () => {
    const updated = setMissionStatus(mission.id, "completed");
    if (updated)
      setMission({
        ...updated,
        result:
          updated.result ||
          "Demo result: Mission marked complete. Full autonomous execution ships in Part 2.",
        progress: 100,
      });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div className="flex items-start gap-3">
          <Link href="/missions" className="mt-1 p-1 rounded-md hover:bg-sidebar">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{mission.title}</h1>
              <MissionBadge status={mission.status} />
            </div>
            <p className="text-sm text-muted mt-1">{mission.goal}</p>
          </div>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Goal</h2>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">{mission.goal}</div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Plan</h2>
          <ol className="rounded-xl border border-border bg-card divide-y divide-border">
            {mission.plan.map((step, i) => (
              <li key={step.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="text-muted w-5">{i + 1}</span>
                <span className="flex-1">{step.title}</span>
                <span className="text-xs text-muted capitalize">{step.status}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Activity</h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            {mission.activity.map((a) => (
              <div key={a.id} className="flex gap-3 text-sm">
                <span className="text-xs text-muted whitespace-nowrap">
                  {new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Result</h2>
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
            {mission.result ||
              "No deliverable yet. Part 1 uses demo mission states. Real tool execution comes next."}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {mission.status === "running" && (
            <button
              onClick={markWaiting}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              Request approval (demo)
            </button>
          )}
          {mission.status !== "completed" && (
            <button
              onClick={markComplete}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Mark completed (demo)
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
