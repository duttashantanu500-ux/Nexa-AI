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
import { runWorkflow } from "@/lib/workflowEngine";
import {
  mapWorkflowResultToRunStatus,
  runStatusLabel,
  statusBadgeClass,
} from "@/lib/runLifecycle";
import {
  canRunAgent,
  fetchBillingStatus,
  recordAgentRun,
  startProCheckout,
} from "@/lib/clientBilling";
import { Agent, AgentRun } from "@/types";

const COMFY_KEY = "nexa_comfy_base_url";
const NOTION_PARENT_KEY = "nexa_notion_default_parent";

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [limitMessage, setLimitMessage] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);

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

  const getComfy = () => {
    try {
      return localStorage.getItem(COMFY_KEY) || "";
    } catch {
      return "";
    }
  };

  const getNotionParent = () => {
    try {
      return localStorage.getItem(NOTION_PARENT_KEY) || "";
    } catch {
      return "";
    }
  };

  const connections = () => ({
    comfyBaseUrl: getComfy(),
    userId: agent?.userId || "",
    notionDefaultParent: getNotionParent(),
  });

  const onUpgrade = async () => {
    setUpgrading(true);
    const r = await startProCheckout();
    if (r.ok) {
      window.location.href = r.checkoutUrl;
      return;
    }
    setError(r.message);
    setUpgrading(false);
  };

  /** Start Work — real execution only. Never simulates success. */
  const execute = async () => {
    if (!agent || running) return;
    if (agent.status === "paused") {
      setError("Resume this AI employee before starting work.");
      return;
    }
    if (!agent.steps?.length) {
      setError("Add workflow steps before running.");
      return;
    }

    setLimitMessage("");
    setError("");
    setNeedsSignIn(false);

    const billing = await fetchBillingStatus(true);
    const check = canRunAgent(billing);
    if (!check.ok) {
      setLimitMessage(check.message);
      return;
    }
    const recorded = await recordAgentRun();
    if (!recorded.ok) {
      const msg = recorded.message || "Could not start work.";
      if (/sign in/i.test(msg)) {
        setNeedsSignIn(true);
        setError(msg);
      } else {
        setLimitMessage(msg);
      }
      return;
    }

    setRunning(true);
    const runId = createRunId();
    const startedAt = new Date().toISOString();

    addAgentRun({
      id: runId,
      agentId: agent.id,
      userId: agent.userId,
      agentVersion: agent.version || 1,
      trigger: "manual",
      triggerSource: `manual:${agent.userId}`,
      status: "queued",
      isTest: false,
      startedAt,
      mode: "real",
      stepResults: [],
    });
    updateAgentRun(runId, { status: "running" });
    refresh();

    try {
      const result = await runWorkflow({
        steps: agent.steps,
        simulate: false,
        connections: connections(),
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
        isTest: false,
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
      const message = e instanceof Error ? e.message : "Work failed";
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
          ? {
              ...s,
              status: "rejected" as const,
              endedAt: new Date().toISOString(),
              error: "Rejected by user",
            }
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
      setError("Work rejected.");
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
        connections: connections(),
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
        error: e instanceof Error ? e.message : "Could not resume work",
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
          AI employee not found.{" "}
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
  const realRuns = runs.filter((r) => !r.isTest && r.mode !== "simulated");

  const scheduleLabel = (() => {
    const sch = agent.schedule;
    if (!sch || sch.frequency === "once" || !sch.enabled) {
      return "Manual work only — this employee does not run on a schedule.";
    }
    const time = sch.time || "09:00";
    if (sch.frequency === "daily") return `Every day at ${time}`;
    if (sch.frequency === "weekly") return `Every week at ${time}`;
    if (sch.frequency === "monthly") return `Every month at ${time}`;
    return String(sch.frequency);
  })();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/agents" className="text-xs text-zinc-500 hover:text-indigo-600">
              ← AI Team
            </Link>
            <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {agent.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{agent.purpose || agent.description}</p>
          </div>
          <span className={statusBadgeClass(String(agent.status))}>
            {String(agent.status).replace(/_/g, " ")}
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase text-zinc-400">Work schedule</div>
          <p className="mt-1 text-zinc-700 dark:text-zinc-300">{scheduleLabel}</p>
          {agent.status === "paused" && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Paused — scheduled runs are off. Resume to allow the schedule again.
            </p>
          )}
        </div>

        {previewOpen && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold">Preview — what this employee will do</h2>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="text-xs text-zinc-500"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Preview does not run any tools or change your connected apps.
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs font-medium text-zinc-500">Name</dt>
                <dd>{agent.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Role</dt>
                <dd>{agent.purpose || agent.description || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Steps</dt>
                <dd>
                  {!agent.steps?.length ? (
                    <span className="text-zinc-500">No steps configured</span>
                  ) : (
                    <ol className="mt-1 list-decimal space-y-1 pl-5">
                      {agent.steps.map((s) => (
                        <li key={s.id}>
                          {s.name || s.actionId}
                          {s.requiresApproval ? (
                            <span className="ml-1 text-xs text-amber-700">(needs approval)</span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void execute()}
            disabled={running || agent.status === "paused"}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {running ? "Working…" : "Start work"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPreviewOpen(true);
              setError("");
            }}
            disabled={running}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => {
              const next = agent.status === "paused" ? "active" : "paused";
              updateAgent(agent.id, {
                status: next,
                schedule: {
                  ...agent.schedule,
                  enabled: next !== "paused" && agent.schedule.frequency !== "once",
                },
              });
              refresh();
            }}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            {agent.status === "paused" ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Delete "${agent.name}"?`)) return;
              deleteAgent(agent.id);
              router.push("/agents");
            }}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
          >
            Delete
          </button>
        </div>

        {limitMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p>{limitMessage}</p>
            {!/sign in/i.test(limitMessage) && (
              <button
                type="button"
                disabled={upgrading}
                onClick={() => void onUpgrade()}
                className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {upgrading ? "Opening…" : "Upgrade to Pro"}
              </button>
            )}
          </div>
        )}

        {needsSignIn && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p>Your session expired. Sign in again to start work.</p>
            <Link
              href="/login"
              className="mt-2 inline-block rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              Sign in
            </Link>
          </div>
        )}

        {error && !needsSignIn && (
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
                  <div className="font-medium">{step?.name || "Write action"}</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => void decideApproval(r, "approved")}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => void decideApproval(r, "rejected")}
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

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 text-xs font-semibold uppercase text-zinc-400">Steps</div>
          {!agent.steps?.length ? (
            <p className="text-sm text-zinc-500">No steps</p>
          ) : (
            <ol className="list-decimal space-y-1 pl-4 text-sm">
              {agent.steps.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ol>
          )}
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Work history</h2>
          {realRuns.length === 0 ? (
            <p className="text-sm text-zinc-500">No work history yet.</p>
          ) : (
            <ul className="space-y-3">
              {realRuns.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className={statusBadgeClass(r.status)}>{runStatusLabel(r.status)}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(r.startedAt).toLocaleString()}
                    </span>
                  </div>
                  {r.output && (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950">
                      {r.output}
                    </pre>
                  )}
                  {r.error && <p className="mt-1 text-xs text-red-600">{r.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
