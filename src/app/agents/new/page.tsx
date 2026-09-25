"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createAgent, loadOperatorState, stepId } from "@/lib/operatorStore";
import {
  ACTION_REGISTRY,
  WORKFLOW_STARTERS,
  availableActions,
  getAction,
} from "@/lib/actionRegistry";
import {
  ScheduleFrequency,
  WorkflowStep,
  defaultPermissions,
  defaultSchedule,
} from "@/types";

const STEPS = ["Start", "Basics", "Actions", "Schedule", "Review"];

export default function NewAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [starterId, setStarterId] = useState("blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("");
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [frequency, setFrequency] = useState<ScheduleFrequency>("once");
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState("UTC");
  const [activate, setActivate] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) router.replace("/signup");
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      /* */
    }
  }, [router]);

  const applyStarter = (id: string) => {
    setStarterId(id);
    const st = WORKFLOW_STARTERS.find((x) => x.id === id);
    if (!st) return;
    setWorkflowSteps(
      st.steps.map((s, i) => {
        const def = getAction(s.actionId);
        return {
          id: stepId(),
          order: i,
          actionId: s.actionId,
          name: def?.name || s.actionId,
          config: { ...s.config },
        };
      })
    );
    if (!name && id !== "blank") setName(st.name);
  };

  const addAction = (actionId: string) => {
    const def = getAction(actionId);
    if (!def || !def.available) return;
    setWorkflowSteps((prev) => [
      ...prev,
      {
        id: stepId(),
        order: prev.length,
        actionId,
        name: def.name,
        config: Object.fromEntries(def.fields.map((f) => [f.key, ""])),
      },
    ]);
  };

  const updateStepConfig = (id: string, key: string, value: string) => {
    setWorkflowSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, config: { ...s.config, [key]: value } } : s
      )
    );
  };

  const removeStep = (id: string) => {
    setWorkflowSteps((prev) =>
      prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }))
    );
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    setWorkflowSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const save = (asDraft: boolean) => {
    const s = loadOperatorState();
    if (!s.user || !name.trim()) return;
    setSaving(true);
    const agent = createAgent({
      userId: s.user.id,
      name: name.trim(),
      description,
      purpose: outcome || description,
      instructions: outcome,
      steps: workflowSteps,
      tools: [...new Set(workflowSteps.map((st) => st.actionId))],
      permissions: defaultPermissions(),
      schedule: {
        ...defaultSchedule(),
        frequency,
        time,
        timezone,
        enabled: frequency !== "once",
      },
      status: asDraft ? "draft" : workflowSteps.length ? "active" : "draft",
    });
    router.push(`/agents/${agent.id}`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold">Create workflow agent</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Build explicit steps. No AI chat required.
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  i === step
                    ? "bg-indigo-600 text-white"
                    : i < step
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-3">
            {WORKFLOW_STARTERS.map((st) => {
              const blocked = st.id === "email";
              return (
                <button
                  key={st.id}
                  type="button"
                  disabled={blocked}
                  onClick={() => applyStarter(st.id)}
                  className={`w-full rounded-xl border p-4 text-left ${
                    starterId === st.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                      : "border-zinc-200 dark:border-zinc-800"
                  } ${blocked ? "opacity-50" : ""}`}
                >
                  <div className="font-medium">{st.name}</div>
                  <p className="mt-1 text-xs text-zinc-500">{st.description}</p>
                  {blocked && (
                    <p className="mt-1 text-[11px] text-amber-600">Coming soon</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Workflow name" value={name} onChange={setName} placeholder="Weekly list cleanup" />
            <Field label="Description (optional)" value={description} onChange={setDescription} textarea />
            <Field
              label="Desired outcome (optional guidance)"
              value={outcome}
              onChange={setOutcome}
              textarea
              placeholder="What should this workflow produce? Not interpreted by AI — just notes for you."
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              {workflowSteps.length === 0 && (
                <p className="text-sm text-zinc-500">No steps yet. Add an action below.</p>
              )}
              {workflowSteps.map((ws, idx) => {
                const def = getAction(ws.actionId);
                return (
                  <div
                    key={ws.id}
                    className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {idx + 1}. {ws.name}
                      </div>
                      <div className="flex gap-1">
                        <button type="button" className="text-xs text-zinc-500" onClick={() => moveStep(ws.id, -1)}>
                          ↑
                        </button>
                        <button type="button" className="text-xs text-zinc-500" onClick={() => moveStep(ws.id, 1)}>
                          ↓
                        </button>
                        <button type="button" className="text-xs text-red-600" onClick={() => removeStep(ws.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                    {def?.fields.map((f) => (
                      <label key={f.key} className="mt-2 block space-y-1">
                        <span className="text-xs text-zinc-500">
                          {f.label}
                          {f.required ? " *" : ""}
                        </span>
                        {f.type === "textarea" ? (
                          <textarea
                            value={ws.config[f.key] || ""}
                            onChange={(e) => updateStepConfig(ws.id, f.key, e.target.value)}
                            rows={3}
                            placeholder={f.placeholder}
                            className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        ) : f.type === "select" ? (
                          <select
                            value={ws.config[f.key] || f.options?.[0]?.value || ""}
                            onChange={(e) => updateStepConfig(ws.id, f.key, e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {(f.options || []).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.type === "number" ? "number" : "text"}
                            value={ws.config[f.key] || ""}
                            onChange={(e) => updateStepConfig(ws.id, f.key, e.target.value)}
                            placeholder={f.placeholder}
                            className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        )}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Add action</div>
              <div className="flex flex-wrap gap-2">
                {availableActions().map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => addAction(a.id)}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs dark:border-zinc-700"
                  >
                    + {a.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                Unavailable actions (e.g. Send email) are not listed.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">When to run</span>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="once">Manual only (Run now)</option>
                <option value="daily">Daily (stored; background needs cron)</option>
                <option value="weekly">Weekly (stored; background needs cron)</option>
                <option value="monthly">Monthly (stored; background needs cron)</option>
              </select>
            </label>
            {frequency !== "once" && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Time</span>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                </label>
                <p className="text-xs text-zinc-500">
                  Timezone: {timezone}. Recurring background runs are not guaranteed
                  without a server scheduler. Use <strong>Run now</strong> anytime.
                </p>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            <div><span className="text-xs text-zinc-500">Name</span><div>{name}</div></div>
            <div><span className="text-xs text-zinc-500">Steps</span>
              <ol className="mt-1 list-decimal pl-4">
                {workflowSteps.map((s) => (
                  <li key={s.id}>{s.name}</li>
                ))}
              </ol>
              {!workflowSteps.length && <p className="text-zinc-500">None — will save as draft</p>}
            </div>
            <div><span className="text-xs text-zinc-500">Schedule</span><div className="capitalize">{frequency}</div></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
              Activate after save (if steps exist)
            </label>
          </div>
        )}

        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={() => (step === 0 ? router.push("/agents") : setStep(step - 1))}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={step === 1 && !name.trim()}
              onClick={() => setStep(step + 1)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving || !name.trim()}
                onClick={() => save(true)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={saving || !name.trim()}
                onClick={() => save(!activate)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                {saving ? "Saving…" : activate ? "Save & activate" : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label, value, onChange, placeholder, textarea,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
      )}
    </label>
  );
}
