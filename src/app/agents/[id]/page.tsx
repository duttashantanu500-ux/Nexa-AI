"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  addAgentRun,
  createRunId,
  deleteAgent,
  duplicateAgent,
  getAgent,
  listAgentRuns,
  loadOperatorState,
  updateAgent,
  updateAgentRun,
} from "@/lib/operatorStore";
import { runWorkflow } from "@/lib/workflowEngine";
import {
  mapWorkflowResultToRunStatus,
  runStatusLabel,
  statusBadgeClass,
} from "@/lib/runLifecycle";
import { Agent, AgentRun } from "@/types";

const COMFY_KEY = "nexa_comfy_base_url";

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const a = getAgent(id);
    setAgent(a);
    if (a) setRuns(listAgentRuns(id));
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
    const next = agent.status === "paused" ? "active" : "paused";
    updateAgent(agent.id, {
      status: next,
      schedule: {
        ...agent.schedule,
        enabled: next !== "paused" && agent.schedule.frequency !== "once",
      },
    });
    refresh();
  };

  const remove = () => {
    if (!agent) return;
    if (!confirm(`Delete "${agent.name}"?`)) return;
    deleteAgent(agent.id);
    router.push("/agents");
  };

  const dup = () => {
    if (!agent) return;
    const copy = duplicateAgent(agent.id);
    if (copy) router.push(`/agents/${copy.id}`);
  };

  const execute = async (simulate: boolean) => {
    if (!agent || running) return;
    if (agent.status === "paused") {
      setError("Resume the agent before running.");
      return;
    }
    if (!agent.steps?.length) {
      setError("Add workflow steps before running.");
      return;
    }

    setRunning(true);
    setError("");
    const runId = createRunId();
    const startedAt = new Date().toISOString();
    const userId = agent.userId;

    // Lifecycle: queued → running (persisted before work starts)
    addAgentRun({
      id: runId,
      agentId: agent.id,
      userId,
      agentVersion: agent.version || 1,
      trigger: simulate ? "test" : "manual",
      triggerSource: simulate ? `test:${userId}` : `manual:${userId}`,
      status: "queued",
      isTest: simulate,
      startedAt,
      mode: simulate ? "simulated" : "real",
      stepResults: [],
    });
    updateAgentRun(runId, { status: "running" });
    refresh();

    let comfyBaseUrl = "";
    try {
      comfyBaseUrl = localStorage.getItem(COMFY_KEY) || "";
    } catch {
      /* */
    }

    try {
      const result = await runWorkflow({
        steps: agent.steps,
        simulate,
        connections: { comfyBaseUrl },
      });
      const endedAt = new Date().toISOString();
      const durationMs = Date.parse(endedAt) - Date.parse(startedAt);
      const finalStatus = mapWorkflowResultToRunStatus(result);

      // Only mark succeeded when every step that claims success has a result record
      const allSucceededHavePayload = result.steps
        .filter((s) => s.status === "succeeded")
        .every((s) => s.output != null || s.outputReceived != null);

      updateAgentRun(runId, {
        status:
          finalStatus === "succeeded" && !allSucceededHavePayload
            ? "failed"
            : finalStatus,
        endedAt,
        durationMs,
        summary: (result.output || "").slice(0, 200),
        output: result.output,
        error: result.error,
        stepResults: result.steps,
        mode: result.mode,
        sources: result.context.sources,
        agentVersion: agent.version || 1,
        isTest: simulate,
      });

      if (finalStatus === "failed" || finalStatus === "succeeded_with_errors") {
        setError(result.error || runStatusLabel(finalStatus));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Run failed";
      updateAgentRun(runId, {
        status: "failed",
        endedAt: new Date().toISOString(),
        error: message,
        summary: "Failed",
      });
      setError(message);
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
            Back
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
            <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {agent.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {agent.purpose || agent.description}
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">Version {agent.version || 1}</p>
          </div>
          <span className={statusBadgeClass(String(agent.status))}>
            {String(agent.status).replace(/_/g, " ")}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => execute(false)}
            disabled={running || agent.status === "paused"}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {running ? "Running…" : "Run now"}
          </button>
          <button
            type="button"
            onClick={() => execute(true)}
            disabled={running}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Preview (simulated)
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
            onClick={dup}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
          >
            Delete
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 text-xs font-semibold uppercase text-zinc-400">
              Workflow steps
            </div>
            {!agent.steps?.length ? (
              <p className="text-sm text-zinc-500">No steps</p>
            ) : (
              <ol className="list-decimal space-y-1 pl-4 text-sm">
                {agent.steps.map((s) => (
                  <li key={s.id}>
                    {s.name}
                    <span className="ml-1 text-[10px] text-zinc-400">
                      ({s.onError || "stop"})
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 text-xs font-semibold uppercase text-zinc-400">Schedule</div>
            <p className="text-sm capitalize">{agent.schedule.frequency}</p>
            <p className="mt-2 text-[11px] text-zinc-400">
              Background scheduler is Phase 5. Prefer Run now.
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Run history</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-zinc-500">No runs yet.</p>
          ) : (
            <ul className="space-y-3">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className={statusBadgeClass(r.status)}>
                      {runStatusLabel(r.status)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(r.startedAt).toLocaleString()}
                      {` · ${r.trigger}`}
                      {r.isTest || r.mode === "simulated" ? " · Test" : " · Live"}
                      {r.agentVersion != null ? ` · v${r.agentVersion}` : ""}
                      {r.durationMs != null ? ` · ${r.durationMs}ms` : ""}
                    </span>
                  </div>

                  {r.stepResults?.map((sr) => (
                    <div key={sr.stepId} className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={
                            sr.status === "succeeded"
                              ? "text-emerald-600"
                              : sr.status === "failed"
                                ? "text-red-600"
                                : "text-zinc-500"
                          }
                        >
                          {sr.status === "succeeded" ? "✓" : sr.status === "failed" ? "✗" : "·"}{" "}
                          {sr.name}
                        </span>
                        {sr.retryCount ? (
                          <span className="text-zinc-400">retries: {sr.retryCount}</span>
                        ) : null}
                        {sr.simulated ? (
                          <span className="text-amber-600">simulated</span>
                        ) : null}
                      </div>
                      {sr.error && (
                        <p className="mt-0.5 text-xs text-red-600">{sr.error}</p>
                      )}
                      {sr.output && !sr.error && (
                        <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{sr.output}</p>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className="mt-2 text-[11px] text-indigo-600"
                    onClick={() =>
                      setExpandedRun(expandedRun === r.id ? null : r.id)
                    }
                  >
                    {expandedRun === r.id ? "Hide audit" : "Show audit (inputs / outputs)"}
                  </button>

                  {expandedRun === r.id && (
                    <div className="mt-2 space-y-2">
                      {r.stepResults?.map((sr) => (
                        <pre
                          key={`${sr.stepId}-audit`}
                          className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 text-[10px] text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400"
                        >
                          {JSON.stringify(
                            {
                              step: sr.name,
                              status: sr.status,
                              inputSent: sr.inputSent,
                              outputReceived: sr.outputReceived,
                              error: sr.error,
                              normalizedError: sr.normalizedError,
                            },
                            null,
                            2
                          )}
                        </pre>
                      ))}
                    </div>
                  )}

                  {r.error && r.status === "failed" && (
                    <p className="mt-2 text-sm text-red-600">{r.error}</p>
                  )}
                  {r.output && (
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950">
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
