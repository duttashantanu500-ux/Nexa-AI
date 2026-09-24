"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MissionBadge } from "@/components/StatusBadge";
import {
  getMission,
  updateMission,
  appendMissionActivity,
  loadOperatorState,
  pushActivity,
} from "@/lib/operatorStore";
import { pushNotification } from "@/lib/notifications";
import { estimateMissionBudget } from "@/lib/missionStateMachine";
import { computeNextRun, ScheduleCadence } from "@/lib/schedules";
import { Mission, MissionStep } from "@/types";
import { ArrowLeft } from "lucide-react";

export default function MissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [mission, setMission] = useState<Mission | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [cadence, setCadence] = useState<ScheduleCadence>("once");

  const reload = () => {
    const m = getMission(id);
    if (!m) {
      router.replace("/missions");
      return;
    }
    setMission(m);
  };

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    reload();
  }, [id, router]);

  if (!mission) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-muted">Loading mission…</div>
      </AppShell>
    );
  }

  const budget = estimateMissionBudget(mission.goal);

  const removeStep = (stepId: string) => {
    if (mission.status !== "ready" && mission.status !== "planning") return;
    const plan = mission.plan.filter((s) => s.id !== stepId);
    const updated = updateMission(mission.id, { plan });
    if (updated) setMission(updated);
  };

  const startMission = async () => {
    if (running) return;
    setRunning(true);
    setError("");

    updateMission(mission.id, { status: "running", progress: 15 });
    appendMissionActivity(mission.id, "Execution started");
    appendMissionActivity(
      mission.id,
      `Budget estimate: ~${budget.estimatedToolCalls} tool calls, ${budget.note}`
    );
    reload();

    const businessContext = loadOperatorState().businessContext;
    const user = loadOperatorState().user;

    try {
      const res = await fetch("/api/missions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: mission.goal,
          businessContext,
          plan: {
            title: mission.title,
            objective: mission.goal,
            steps: mission.plan,
            researchQuery: mission.researchQuery || mission.goal,
          },
        }),
      });

      const data = await res.json();

      for (const line of data.activity || []) {
        appendMissionActivity(mission.id, line);
      }

      const steps = (data.steps || mission.plan) as MissionStep[];

      if (data.ok && data.status === "completed") {
        updateMission(mission.id, {
          status: "completed",
          progress: 100,
          plan: steps,
          result: data.deliverable?.content,
          deliverable: data.deliverable
            ? {
                type: data.deliverable.type,
                title: data.deliverable.title,
                content: data.deliverable.content,
                rows: data.deliverable.rows,
                sources: data.deliverable.sources || [],
                createdAt: data.deliverable.createdAt,
              }
            : undefined,
        });
        if (user) {
          pushActivity(
            user.id,
            `Mission completed: ${mission.title}`,
            "mission",
            mission.id
          );
          pushNotification(
            user.id,
            "mission_completed",
            "Mission completed",
            mission.title,
            mission.id
          );
        }
      } else {
        updateMission(mission.id, {
          status: "failed",
          progress: data.progress ?? 50,
          plan: steps,
          error: data.error || "Execution failed",
        });
        setError(data.error || "Execution failed");
        if (user) {
          pushNotification(
            user.id,
            "mission_failed",
            "Mission failed",
            data.error || mission.title,
            mission.id
          );
        }
      }
    } catch (e: any) {
      updateMission(mission.id, {
        status: "failed",
        error: e?.message || "Network error",
      });
      appendMissionActivity(mission.id, `Failed: ${e?.message || "Network error"}`, "warning");
      setError(e?.message || "Network error");
    } finally {
      setRunning(false);
      reload();
    }
  };

  const cancel = () => {
    updateMission(mission.id, { status: "cancelled", progress: 100 });
    appendMissionActivity(mission.id, "Mission cancelled by user");
    reload();
  };

  const saveSchedule = () => {
    const nextRunAt = computeNextRun(cadence);
    // Stored on mission via result note until full schedule schema is server-side
    appendMissionActivity(
      mission.id,
      `Schedule set: ${cadence} (next local reminder ${new Date(nextRunAt).toLocaleString()}). Background runs require server schedule queue.`
    );
    reload();
  };

  const canStart =
    (mission.status === "ready" ||
      mission.status === "planning" ||
      mission.status === "failed") &&
    mission.plan.length > 0 &&
    !running;

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
              <MissionBadge status={running ? "running" : mission.status} />
            </div>
            <p className="text-sm text-muted mt-1">{mission.goal}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted">
          Estimated usage: ~{budget.estimatedToolCalls} tool calls · {budget.note}
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Goal</h2>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">{mission.goal}</div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Plan</h2>
            {(mission.status === "ready" || mission.status === "planning") && (
              <span className="text-xs text-muted">Remove steps before starting</span>
            )}
          </div>
          <ol className="rounded-xl border border-border bg-card divide-y divide-border">
            {mission.plan.map((step, i) => (
              <li key={step.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="text-muted w-5">{i + 1}</span>
                <span className="flex-1">{step.title}</span>
                <span className="text-xs text-muted capitalize">{step.status}</span>
                {(mission.status === "ready" || mission.status === "planning") && (
                  <button
                    onClick={() => removeStep(step.id)}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
            {mission.plan.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted">No plan yet</li>
            )}
          </ol>
        </section>

        <div className="flex flex-wrap gap-2">
          {canStart && (
            <button
              onClick={startMission}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {mission.status === "failed" ? "Retry Mission" : "Start Mission"}
            </button>
          )}
          {running && (
            <span className="text-sm text-muted animate-pulse px-2 py-2">
              Nexa is working…
            </span>
          )}
          {(mission.status === "ready" ||
            mission.status === "running" ||
            mission.status === "paused") &&
            !running && (
              <button onClick={cancel} className="rounded-lg border border-border px-3 py-2 text-sm">
                Cancel
              </button>
            )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Schedule (preview)</h2>
          <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-2 items-center">
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as ScheduleCadence)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <button
              onClick={saveSchedule}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              Save schedule note
            </button>
            <p className="text-xs text-muted w-full">
              True offline background runs need a server job queue (Part 3 infrastructure). Cron
              endpoint is installed; schedules process when the server queue is connected.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Activity</h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-h-72 overflow-y-auto">
            {mission.activity.map((a) => (
              <div key={a.id} className="flex gap-3 text-sm">
                <span className="text-xs text-muted whitespace-nowrap">
                  {new Date(a.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Result</h2>
          {mission.deliverable ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="text-sm font-medium">{mission.deliverable.title}</div>
              {mission.deliverable.rows && mission.deliverable.rows.length > 0 && (
                <div className="space-y-3">
                  {mission.deliverable.rows.map((r, i) => (
                    <div key={i} className="text-sm border-b border-border pb-3 last:border-0">
                      <div className="font-medium">
                        {i + 1}. {r.company}
                      </div>
                      <a
                        href={r.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-600 break-all"
                      >
                        {r.website}
                      </a>
                      <p className="text-xs text-muted mt-1">{r.evidence}</p>
                    </div>
                  ))}
                </div>
              )}
              <pre className="text-xs whitespace-pre-wrap text-muted">
                {mission.deliverable.content}
              </pre>
              {mission.deliverable.sources?.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-1">Sources</div>
                  <ul className="space-y-1">
                    {mission.deliverable.sources.map((s, i) => (
                      <li key={i} className="text-xs">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-600 break-all"
                        >
                          {s.title || s.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
              {mission.result ||
                (mission.status === "completed"
                  ? "Completed with no structured deliverable."
                  : "Start the mission to run real web research.")}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
