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
  const [queueing, setQueueing] = useState(false);
  const [error, setError] = useState("");
  const [bgMsg, setBgMsg] = useState("");
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

  // Poll server status when mission is running/queued for background
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/missions/status?id=${id}`);
        const data = await res.json();
        if (!alive || !data.ok || !data.found) return;
        const sm = data.mission;
        updateMission(id, {
          status: sm.status,
          progress: sm.progress,
          plan: sm.plan || undefined,
          activity: sm.activity || undefined,
          deliverable: sm.deliverable || undefined,
          result: sm.result || undefined,
          error: sm.error || undefined,
        });
        if (alive) reload();
        if (sm.status === "completed" || sm.status === "failed") {
          setRunning(false);
        }
      } catch {
        /* offline poll ok */
      }
    };
    const t = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

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
    appendMissionActivity(mission.id, "Execution started (this tab)");
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
          pushActivity(user.id, `Mission completed: ${mission.title}`, "mission", mission.id);
          pushNotification(user.id, "mission_completed", "Mission completed", mission.title, mission.id);
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
          pushNotification(user.id, "mission_failed", "Mission failed", data.error || mission.title, mission.id);
        }
      }
    } catch (e: any) {
      updateMission(mission.id, { status: "failed", error: e?.message || "Network error" });
      appendMissionActivity(mission.id, `Failed: ${e?.message || "Network error"}`, "warning");
      setError(e?.message || "Network error");
    } finally {
      setRunning(false);
      reload();
    }
  };

  const runInBackground = async () => {
    const user = loadOperatorState().user;
    if (!user || queueing) return;
    setQueueing(true);
    setBgMsg("");
    setError("");

    try {
      const res = await fetch("/api/missions/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: mission.id,
          userId: user.id,
          title: mission.title,
          goal: mission.goal,
          plan: mission.plan,
          researchQuery: mission.researchQuery || mission.goal,
          scheduleCadence: cadence !== "once" ? cadence : undefined,
          runNow: true,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(
          data.error ||
            "Background queue not ready. Add SUPABASE_SERVICE_ROLE_KEY and run missions_schema.sql"
        );
        return;
      }
      updateMission(mission.id, { status: "running", progress: 10 });
      appendMissionActivity(
        mission.id,
        "Queued for 24/7 background worker — safe to close this tab"
      );
      setBgMsg(
        data.message ||
          "Queued. Worker runs every ~5 minutes via Vercel Cron even if you close the browser."
      );
      setRunning(true);
      reload();

      // Kick worker immediately
      fetch("/api/cron/schedules", { method: "POST" }).catch(() => {});
    } catch (e: any) {
      setError(e?.message || "Could not queue");
    } finally {
      setQueueing(false);
    }
  };

  const cancel = () => {
    updateMission(mission.id, { status: "cancelled", progress: 100 });
    appendMissionActivity(mission.id, "Mission cancelled by user");
    setRunning(false);
    reload();
  };

  const canStart =
    (mission.status === "ready" ||
      mission.status === "planning" ||
      mission.status === "failed") &&
    mission.plan.length > 0 &&
    !running &&
    !queueing;

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

        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted space-y-1">
          <div>Estimated usage: ~{budget.estimatedToolCalls} tool calls · {budget.note}</div>
          <div>
            <strong className="text-foreground">24/7:</strong> use "Run in background" so work continues after you close the tab (requires Supabase service role + schema).
          </div>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Plan</h2>
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
          </ol>
        </section>

        <div className="flex flex-wrap gap-2">
          {canStart && (
            <>
              <button
                onClick={startMission}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Run in this tab
              </button>
              <button
                onClick={runInBackground}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                {queueing ? "Queueing…" : "Run in background (24/7)"}
              </button>
            </>
          )}
          {running && (
            <span className="text-sm text-muted animate-pulse px-2 py-2">
              Working… (safe to leave if background queued)
            </span>
          )}
          {(mission.status === "ready" || mission.status === "running" || mission.status === "paused") &&
            !queueing && (
              <button onClick={cancel} className="rounded-lg border border-border px-3 py-2 text-sm">
                Cancel
              </button>
            )}
        </div>

        {bgMsg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{bgMsg}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Repeat schedule</h2>
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
            <p className="text-xs text-muted w-full">
              Choose cadence before "Run in background" to re-queue on a schedule via Cron.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Activity</h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-h-72 overflow-y-auto">
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
          {mission.deliverable ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="text-sm font-medium">{mission.deliverable.title}</div>
              {mission.deliverable.rows?.map((r, i) => (
                <div key={i} className="text-sm border-b border-border pb-3">
                  <div className="font-medium">
                    {i + 1}. {r.company}
                  </div>
                  <a href={r.website} target="_blank" rel="noreferrer" className="text-xs text-sky-600 break-all">
                    {r.website}
                  </a>
                  <p className="text-xs text-muted mt-1">{r.evidence}</p>
                </div>
              ))}
              {mission.deliverable.sources?.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-1">Sources</div>
                  {mission.deliverable.sources.map((s, i) => (
                    <div key={i} className="text-xs">
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-600 break-all">
                        {s.title || s.url}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
              {mission.result || "No result yet."}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
