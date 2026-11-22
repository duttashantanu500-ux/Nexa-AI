"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  RobotAvatar,
  resolveAgentAvatar,
} from "@/components/robots/RobotAvatar";
import {
  addAgentRun,
  createRunId,
  deleteAgent,
  getAgent,
  listAgentRuns,
  loadOperatorState,
  saveOperatorState,
  updateAgent,
  updateAgentRun,
} from "@/lib/operatorStore";
import { fetchServerAgents } from "@/lib/serverAgentClient";
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
import { Agent, AgentRun, WorkflowStep } from "@/types";
import { EmployeeBuilderChat } from "@/components/EmployeeBuilderChat";
import { UpgradeLimitModal } from "@/components/UpgradeLimitModal";
import {
  injectNotionParentIntoSteps,
  resolveNotionParentForHire,
} from "@/lib/notionParent";

const NOTION_PARENT_KEY = "nexa_notion_default_parent";

function isNotionParentSetupError(msg: string | undefined | null): boolean {
  if (!msg) return false;
  return /default page|parent page|set a default page/i.test(msg);
}

function toStringConfig(config: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!config || typeof config !== "object") return out;
  for (const [k, v] of Object.entries(config)) {
    if (v == null) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

/** Normalize agent steps into WorkflowStep[] for the engine. */
function toWorkflowSteps(agent: Agent): WorkflowStep[] {
  const raw = Array.isArray(agent.steps) ? agent.steps : [];
  return raw.map((st: any, i: number) => ({
    id: String(st.id || `step_${i}`),
    order: typeof st.order === "number" ? st.order : i,
    actionId: String(st.actionId || ""),
    name: String(st.name || st.actionId || `Step ${i + 1}`),
    config: toStringConfig(st.config),
    onError: st.onError === "continue" || st.onError === "retry" ? st.onError : "stop",
    requiresApproval: Boolean(st.requiresApproval),
  }));
}

/** Fill empty step configs so Start work can run without builder jargon. */
function withRunnableDefaults(
  agent: Agent,
  parentId?: string | null,
  parentLabel?: string | null
): Agent {
  const purpose = (agent.purpose || agent.description || agent.name || "Work").trim();
  const titleGuess =
    purpose.length > 80 ? purpose.slice(0, 77) + "…" : purpose;
  const base = Array.isArray(agent.steps) ? agent.steps : [];
  let steps = base.map((st: any) => {
    const config = { ...(st.config || {}) } as Record<string, unknown>;
    const action = String(st.actionId || "");
    if (action === "local_data.list_from_text" && !String(config.text || "").trim()) {
      config.text = purpose;
    }
    if (action === "local_data.report" && !String(config.title || "").trim()) {
      config.title = titleGuess || "Report";
    }
    if (action === "local_data.note" && !String(config.note || "").trim()) {
      config.note = purpose;
    }
    if (action === "notion.create_page") {
      if (!String(config.title || "").trim()) config.title = titleGuess || "New page";
      if (!String(config.content || "").trim()) {
        config.content = `Work output from ${agent.name}.\n\n${purpose}`;
      }
    }
    if (action === "slack.post_message" && !String(config.text || "").trim()) {
      config.text = purpose;
    }
    if (action === "buffer.create_post" && !String(config.text || "").trim()) {
      config.text = purpose;
    }
    return { ...st, config };
  });
  if (parentId) {
    steps = injectNotionParentIntoSteps(
      steps as any,
      parentId,
      parentLabel || undefined
    ) as typeof steps;
  }
  return { ...agent, steps: Array.isArray(steps) ? steps : [] };
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [limitMessage, setLimitMessage] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [notionParentInput, setNotionParentInput] = useState("");
  const [notionParentSaved, setNotionParentSaved] = useState(false);

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
    try {
      setNotionParentInput(localStorage.getItem(NOTION_PARENT_KEY) || "");
    } catch {
      /* */
    }
    let cancelled = false;
    (async () => {
      try {
        const local = getAgent(id);
        if (local?.steps?.length) return;
        const remote = await fetchServerAgents();
        if (!remote.ok || cancelled) return;
        const match = (remote.agents || []).find((r: any) => r?.id === id);
        if (!match) return;
        const st = loadOperatorState();
        const uid = st.user?.id || match.userId || "";
        const merged = {
          id: match.id,
          userId: uid,
          name: match.name || "AI Employee",
          description: match.description || "",
          purpose: match.purpose || match.description || "",
          status: match.status || "active",
          version: match.version || 1,
          steps: Array.isArray(match.steps) ? match.steps : [],
          schedule: match.schedule || { frequency: "once", enabled: false },
          createdAt: match.createdAt || new Date().toISOString(),
          updatedAt: match.updatedAt || new Date().toISOString(),
        } as Agent;
        const op = loadOperatorState();
        const agents = (op.agents || []).filter((a) => a.id !== id);
        agents.push(merged);
        saveOperatorState({ ...op, agents });
        if (!cancelled) {
          setAgent(merged);
          setRuns(listAgentRuns(id));
        }
      } catch {
        /* */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, refresh, router]);

  const execute = useCallback(async () => {
    if (!agent || running) return;
    setError("");
    setLimitMessage("");
    setRunning(true);
    const s = loadOperatorState();
    const uid = s.user?.id || "";
    if (!uid) {
      setNeedsSignIn(true);
      setRunning(false);
      return;
    }
    try {
      const bill = await fetchBillingStatus();
      if (!canRunAgent(bill)) {
        setLimitMessage(
          "You've reached your plan limit for work runs this month."
        );
        setRunning(false);
        return;
      }
    } catch {
      /* continue */
    }

    let parentId: string | null = null;
    let parentLabel: string | null = null;
    try {
      const resolved = await resolveNotionParentForHire(uid);
      parentId = resolved.parentId || null;
      parentLabel = resolved.parentLabel || null;
    } catch {
      try {
        parentId = localStorage.getItem(NOTION_PARENT_KEY);
      } catch {
        /* */
      }
    }
    if (!parentId) {
      try {
        parentId = localStorage.getItem(NOTION_PARENT_KEY);
      } catch {
        /* */
      }
    }

    const runnable = withRunnableDefaults(agent, parentId, parentLabel);
    const steps = toWorkflowSteps(runnable);
    if (!steps.length) {
      setError("This employee has no steps yet. Configure work in the chat first.");
      setRunning(false);
      return;
    }

    try {
      updateAgent(agent.id, { steps: runnable.steps as any });
      setAgent({ ...agent, steps: runnable.steps });
    } catch {
      /* */
    }

    const runId = createRunId();
    const startedAt = new Date().toISOString();
    addAgentRun({
      id: runId,
      agentId: agent.id,
      userId: uid,
      status: "running",
      startedAt,
      summary: "Starting work…",
    } as any);
    refresh();

    try {
      const result = await runWorkflow({
        steps,
        connections: {
          userId: uid,
          notionDefaultParent: parentId || undefined,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      const status = mapWorkflowResultToRunStatus(result);
      const summary =
        result.output ||
        result.error ||
        (status === "succeeded"
          ? "Work completed."
          : status === "waiting_for_approval"
            ? "Waiting for your approval."
            : "Work finished with issues.");
      updateAgentRun(runId, {
        status,
        finishedAt: new Date().toISOString(),
        summary,
        error: result.error || undefined,
        outputs: result.context as any,
        steps: result.steps as any,
      } as any);
      try {
        await recordAgentRun();
      } catch {
        /* */
      }
      if (!result.ok && result.error) {
        if (isNotionParentSetupError(result.error)) {
          setError(
            "Notion needs a default parent page. Set one below or pick a page in the chat, then try again."
          );
        } else {
          setError(result.error);
        }
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      updateAgentRun(runId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        summary: "Work failed",
        error: msg,
      });
      if (isNotionParentSetupError(msg)) {
        setError(
          "Notion needs a default parent page. Set one below or pick a page in the chat, then try again."
        );
      } else {
        setError(msg);
      }
    }
    setRunning(false);
    refresh();
  }, [agent, running, refresh]);

  const saveNotionParent = () => {
    const v = notionParentInput.trim();
    try {
      if (v) localStorage.setItem(NOTION_PARENT_KEY, v);
      else localStorage.removeItem(NOTION_PARENT_KEY);
      setNotionParentSaved(true);
      setTimeout(() => setNotionParentSaved(false), 2000);
    } catch {
      /* */
    }
  };

  const onDelete = () => {
    if (!agent) return;
    if (!confirm(`Remove ${agent.name}? This cannot be undone.`)) return;
    deleteAgent(agent.id);
    router.push("/agents");
  };

  if (!agent) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-12">
          <p className="text-zinc-500">Loading employee…</p>
        </div>
      </AppShell>
    );
  }

  const realRuns = runs.filter((r) => r.status !== "preview");

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <RobotAvatar
              seed={resolveAgentAvatar(agent)}
              size={56}
              className="shrink-0"
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {agent.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {agent.purpose || agent.description || "AI Employee"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void execute()}
              disabled={running}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {running ? "Working…" : "Start work"}
            </button>
            <Link
              href="/agents"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Back
            </Link>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 dark:border-red-900"
            >
              Remove
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
        {limitMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {limitMessage}{" "}
            <button
              type="button"
              className="underline"
              disabled={upgrading}
              onClick={async () => {
                setUpgrading(true);
                try {
                  await startProCheckout();
                } finally {
                  setUpgrading(false);
                }
              }}
            >
              Upgrade to Pro
            </button>
          </div>
        )}
        {needsSignIn && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            Sign in to run work.{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </div>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Assigned work
          </h2>
          {(agent.steps || []).length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              No steps yet. Use the chat below to configure this employee.
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {(agent.steps || []).map((st: any, i: number) => (
                <li
                  key={st.id || i}
                  className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium dark:bg-zinc-800">
                    {i + 1}
                  </span>
                  <span className="font-medium">{st.name || st.actionId}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Notion parent page
          </h2>
          <p className="mb-2 text-xs text-zinc-500">
            Required when this employee creates Notion pages. Paste a page ID or
            URL, or pick a page in the chat.
          </p>
          <div className="flex gap-2">
            <input
              value={notionParentInput}
              onChange={(e) => setNotionParentInput(e.target.value)}
              placeholder="Page ID or Notion URL"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={saveNotionParent}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save
            </button>
          </div>
          {notionParentSaved && (
            <p className="mt-1 text-xs text-green-600">Saved</p>
          )}
        </section>

        <EmployeeBuilderChat agentId={agent.id} onRequestWork={execute} />

        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Work history
          </h2>
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
                    <span className={statusBadgeClass(r.status)}>
                      {runStatusLabel(r.status)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {r.startedAt
                        ? new Date(r.startedAt).toLocaleString()
                        : ""}
                    </span>
                  </div>
                  {r.summary && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {r.summary}
                    </p>
                  )}
                  {r.error && (
                    <p className="mt-1 text-xs text-red-600">{r.error}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <UpgradeLimitModal
        open={Boolean(limitMessage)}
        message={limitMessage}
        onClose={() => setLimitMessage("")}
        onUpgrade={async () => {
          setUpgrading(true);
          try {
            await startProCheckout();
          } finally {
            setUpgrading(false);
          }
        }}
        upgrading={upgrading}
      />
    </AppShell>
  );
}
