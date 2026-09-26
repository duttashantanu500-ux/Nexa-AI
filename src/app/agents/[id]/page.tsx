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
import { advanceAgentSchedule } from "@/lib/clientScheduler";
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

  const getComfy = () => {
    try {
      return localStorage.getItem(COMFY_KEY) || "";
    } catch {
      return "";
    }
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

    addAgentRun({
      id: runId,
      agentId: agent.id,
      userId: agent.userId,
      agentVersion: agent.version || 1,
      trigger: simulate ? "test" : "manual",
      triggerSource: simulate ? `test:${agent.userId}` : `manual:${agent.userId}`,
      status: "queued",
      isTest: simulate,
      startedAt,
      mode: simulate ? "simulated" : "real",
      stepResults: [],
    });
    updateAgentRun(runId, { status: "running" });
    refresh();

    try {
      const result = await runWorkflow({
        steps: agent.steps,
        simulate,
        connections: { comfyBaseUrl: getComfy(), userId: agent.userId },
      });
      const endedAt = new Date().toISOString();
      const durationMs = Date.parse(endedAt) - Date.parse(startedAt);
      const finalStatus = mapWorkflowResultToRunStatus(result);

      updateAgentRun(runId, {
        status: finalStatus,
        endedAt: finalStatus === "waiting_for_approval" ? null : endedAt,
        durationMs: finalStatus === "waiting_for_approval" ? null : durationMs,
        summary: (result.output || "").slice(0, 200),
        output: result.output,
        error: result.error,
        stepResults: result.steps,
        mode: result.mode,
        sources: result.context.sources,
        agentVersion: agent.version || 1,
        isTest: simulate,
        pendingStepId: result.pendingStepId,
        pendingStepIndex: result.pendingStepIndex,
        contextSnapshot: {
          list: result.context.list,
          notes: result.context.notes,
          report: result.context.report,
          imageUrl: result.context.imageUrl,
          vars: result.context.vars,
          sources: result.context.sources,
          stepOutputs: result.context.stepOutputs,
        },
      });

      if (finalStatus === "waiting_for_approval") {
        setError("A step needs your approval before it can run.");
      } else if (finalStatus === "failed" || finalStatus === "succeeded_with_errors") {
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

  const decideApproval = async (run: AgentRun, decision: "approved" | "rejected") => {
    if (!agent || running) return;
    if (run.status !== "waiting_for_approval" && run.status !== "waiting_approval") return;

    if (decision === "rejected") {
      const steps = (run.stepResults || []).map((s) =>
        s.status === "awaiting_approval"
          ? { ...s, status: "rejected" as const, endedAt: new Date().toISOString(), error: "Rejected by user" }
          : s
      );
      updateAgentRun(run.id, {
        status: "failed",
        endedAt: new Date().toISOString(),
        error: "Rejected by user",
        stepResults: steps,
        pendingStepId: undefined,
        pendingStepIndex: undefined,
      });
      setError("Run rejected.");
      refresh();
      return;
    }

    setRunning(true);
    setError("");
    updateAgentRun(run.id, { status: "running" });

    try {
      const startIndex = run.pendingStepIndex ?? 0;
      const result = await runWorkflow({
        steps: agent.steps,
        simulate: false,
        connections: { comfyBaseUrl: getComfy(), userId: agent.userId },
        startIndex,
        priorResults: (run.stepResults || []).filter((s) => s.status !== "awaiting_approval"),
        priorContext: run.contextSnapshot,
        approvalGrantedForStepId: run.pendingStepId,
      });
      const finalStatus = mapWorkflowResultToRunStatus(result);
      updateAgentRun(run.id, {
        status: finalStatus,
        endedAt: finalStatus === "waiting_for_approval" ? null : new Date().toISOString(),
        summary: (result.output || "").slice(0, 200),
        output: result.output,
        error: result.error,
        stepResults: result.steps,
        mode: result.mode,
        sources: result.context.sources,
        pendingStepId: result.pendingStepId,
        pendingStepIndex: result.pendingStepIndex,
        contextSnapshot: {
          list: result.context.list,
          notes: result.context.notes,
          report: result.context.report,
          imageUrl: result.context.imageUrl,
          vars: result.context.vars,
          sources: result.context.sources,
          stepOutputs: result.context.stepOutputs,
        },
      });
      if (finalStatus === "waiting_for_approval") {
        setError("Another step needs approval.");
      }
    } catch (e: unknown) {
      updateAgentRun(run.id, {
        status: "failed",
        endedAt: new Date().toISOString(),
        error: e instanceof Error ? e.message : "Resume failed",
      });
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

  const waiting = runs.filter(
    (r) => r.status === "waiting_for_approval" || r.status === "waiting_approval"
  );

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
            <p className="mt-1 text-sm text-zinc-500">{agent.purpose || agent.description}</p>
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
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {error}
          </div>
        )}

        {waiting.length > 0 && (
          <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Waiting for your approval
            </h2>
            {waiting.map((r) => {
              const step = r.stepResults?.find((s) => s.status === "awaiting_approval");
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">{step?.name || "Write action"}</div>
                    <pre className="mt-1 max-h-20 overflow-auto text-[11px] text-zinc-600 dark:text-zinc-400">
                      {JSON.stringify(step?.inputSent || {}, null, 0)}
                    </pre>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => decideApproval(r, "approved")}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => decideApproval(r, "rejected")}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 text-xs font-semibold uppercase text-zinc-400">Workflow steps</div>
            {!agent.steps?.length ? (
              <p className="text-sm text-zinc-500">No steps</p>
            ) : (
              <ol className="list-decimal space-y-1 pl-4 text-sm">
                {agent.steps.map((s) => (
                  <li key={s.id}>
                    {s.name}
                    {(s.requiresApproval || false) && (
                      <span className="ml-1 text-[10px] text-amber-600">approval</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 text-xs font-semibold uppercase text-zinc-400">Schedule</div>
            <p className="text-sm capitalize">{agent.schedule.frequency}</p>
            {agent.schedule.nextRunAt && (
              <p className="mt-1 text-xs text-zinc-500">
                Next: {new Date(agent.schedule.nextRunAt).toLocaleString()}
              </p>
            )}
            <p className="mt-2 text-[11px] text-zinc-400">
              Browser schedules need the app open or Run now.
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Run history</h2>
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
                    <span className={statusBadgeClass(r.status)}>{runStatusLabel(r.status)}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(r.startedAt).toLocaleString()}
                      {` · ${r.trigger}`}
                      {r.isTest || r.mode === "simulated" ? " · Test" : " · Live"}
                    </span>
                  </div>
                  {r.stepResults?.map((sr) => (
                    <div key={sr.stepId} className="mt-2 border-t border-zinc-100 pt-2 text-xs dark:border-zinc-800">
                      <span
                        className={
                          sr.status === "succeeded"
                            ? "text-emerald-600"
                            : sr.status === "failed" || sr.status === "rejected"
                              ? "text-red-600"
                              : sr.status === "awaiting_approval"
                                ? "text-amber-600"
                                : "text-zinc-500"
                        }
                      >
                        {sr.status} — {sr.name}
                      </span>
                      {sr.error && <p className="text-red-600">{sr.error}</p>}
                    </div>
                  ))}
                  {r.output && (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950">
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
