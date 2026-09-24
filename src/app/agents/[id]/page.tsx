"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  addAgentRun,
  createRunId,
  deleteAgent,
  getAgent,
  listAgentRuns,
  loadOperatorState,
  updateAgent,
  updateAgentRun,
} from "@/lib/operatorStore";
import { Agent, AgentRun } from "@/types";

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    const a = getAgent(id);
    if (!a) {
      setAgent(null);
      return;
    }
    setAgent(a);
    setRuns(listAgentRuns(id));
  }, [id]);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    refresh();
  }, [router, refresh]);

  const togglePause = () => {
    if (!agent) return;
    updateAgent(agent.id, {
      status: agent.status === "paused" ? "active" : "paused",
      schedule: {
        ...agent.schedule,
        enabled: agent.status === "paused",
      },
    });
    refresh();
  };

  const remove = () => {
    if (!agent) return;
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    deleteAgent(agent.id);
    router.push("/agents");
  };

  const runNow = async () => {
    if (!agent || running) return;
    if (agent.status === "paused") {
      setError("Resume the agent before running.");
      return;
    }
    const hasWeb =
      agent.tools.includes("web_search") ||
      agent.tools.includes("web_page_reader");
    if (!hasWeb) {
      setError("This agent has no executable tools available yet.");
      return;
    }

    setRunning(true);
    setError("");
    const runId = createRunId();
    const startedAt = new Date().toISOString();
    addAgentRun({
      id: runId,
      agentId: agent.id,
      userId: agent.userId,
      trigger: "manual",
      status: "running",
      startedAt,
    });
    refresh();

    try {
      const goal = [
        agent.instructions || agent.purpose,
        agent.expectedOutput ? `Expected output: ${agent.expectedOutput}` : "",
        agent.constraints ? `Constraints: ${agent.constraints}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/missions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      const endedAt = new Date().toISOString();
      const durationMs = Date.parse(endedAt) - Date.parse(startedAt);

      if (!data.ok) {
        updateAgentRun(runId, {
          status: "failed",
          endedAt,
          durationMs,
          error: data.error || "Run failed",
          summary: "Failed",
        });
        setError(data.error || "Run failed");
      } else {
        const content = data.deliverable?.content || "Completed";
        updateAgentRun(runId, {
          status: data.status === "completed" ? "completed" : "partial",
          endedAt,
          durationMs,
          summary: content.slice(0, 200),
          output: content,
          sources: data.deliverable?.sources || [],
        });
      }
    } catch {
      updateAgentRun(runId, {
        status: "failed",
        endedAt: new Date().toISOString(),
        error: "Network error",
        summary: "Network error",
      });
      setError("Could not reach the server. Try again.");
    } finally {
      setRunning(false);
      refresh();
    }
  };

  if (!agent) {
    return (
      <AppShell>
        <div className="px-4 py-16 text-center text-sm text-zinc-500">
          Agent not found.{" "}
          <Link href="/agents" className="text-indigo-600">
            Back to agents
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/agents" className="text-xs text-zinc-500 hover:text-indigo-600">
              ← Agents
            </Link>
            <h1 className="mt-1 text-xl font-semibold">{agent.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{agent.purpose}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
              agent.status === "active"
                ? "bg-emerald-50 text-emerald-700"
                : agent.status === "paused"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {agent.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runNow}
            disabled={running || agent.status === "paused"}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {running ? "Running…" : "Run now"}
          </button>
          <button
            type="button"
            onClick={togglePause}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            {agent.status === "paused" ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 dark:border-red-900"
          >
            Delete
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Instructions">
            <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
              {agent.instructions || "—"}
            </p>
            {agent.constraints && (
              <p className="mt-2 text-xs text-zinc-500">
                Constraints: {agent.constraints}
              </p>
            )}
          </Card>
          <Card title="Tools">
            <ul className="text-sm text-zinc-600 dark:text-zinc-300">
              {agent.tools.map((t) => (
                <li key={t}>• {t}</li>
              ))}
            </ul>
          </Card>
          <Card title="Schedule">
            <p className="text-sm capitalize">{agent.schedule.frequency}</p>
            {agent.schedule.frequency !== "once" && (
              <p className="mt-1 text-xs text-zinc-500">
                {agent.schedule.time} · {agent.schedule.timezone}
                {agent.schedule.nextRunAt && (
                  <>
                    <br />
                    Next: {new Date(agent.schedule.nextRunAt).toLocaleString()}
                  </>
                )}
              </p>
            )}
            <p className="mt-2 text-[11px] text-zinc-400">
              Background schedules need server cron. Use Run now anytime.
            </p>
          </Card>
          <Card title="Permissions">
            <p className="text-sm capitalize">{agent.permissions.mode.replace("_", " ")}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Destructive: {agent.permissions.allowDestructive ? "allowed" : "blocked"}
            </p>
          </Card>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Run history</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-zinc-500">No runs yet. Use Run now to execute.</p>
          ) : (
            <ul className="space-y-3">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium capitalize">{r.status}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(r.startedAt).toLocaleString()}
                      {r.durationMs != null ? ` · ${Math.round(r.durationMs / 1000)}s` : ""}
                      {` · ${r.trigger}`}
                    </span>
                  </div>
                  {r.error && (
                    <p className="mt-2 text-sm text-red-600">{r.error}</p>
                  )}
                  {r.output && (
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                      {r.output}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </div>
      {children}
    </div>
  );
}
