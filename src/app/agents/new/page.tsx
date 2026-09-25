"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createAgent, loadOperatorState } from "@/lib/operatorStore";
import {
  AGENT_TEMPLATES,
  BUILTIN_TOOLS,
  PermissionMode,
  ScheduleFrequency,
  defaultPermissions,
  defaultSchedule,
} from "@/types";

const STEPS = ["Basics", "Instructions", "Tools", "Schedule", "Permissions", "Review"];

function NewAgentForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState("");
  const [instructions, setInstructions] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [constraints, setConstraints] = useState("");
  const [templateType, setTemplateType] = useState("custom");
  const [tools, setTools] = useState<string[]>(["web_search", "web_page_reader"]);
  const [frequency, setFrequency] = useState<ScheduleFrequency>("once");
  const [time, setTime] = useState("09:00");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timezone, setTimezone] = useState("UTC");
  const [permMode, setPermMode] = useState<PermissionMode>("read");
  const [allowDestructive, setAllowDestructive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) router.replace("/signup");
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      /* */
    }
    const tid = params.get("template");
    if (tid) {
      const t = AGENT_TEMPLATES.find((x) => x.id === tid);
      if (t && t.executable) {
        setTemplateType(t.id);
        setName(t.name);
        setDescription(t.description);
        setPurpose(t.purpose);
        setInstructions(t.instructions);
        setTools(t.tools.length ? t.tools : ["web_search"]);
      }
    }
  }, [router, params]);

  const availableTools = useMemo(() => BUILTIN_TOOLS.filter((t) => t.available), []);

  const toggleTool = (id: string) => {
    setTools((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const canNext = () => {
    if (step === 0) return name.trim().length > 0 && purpose.trim().length > 0;
    if (step === 1) return instructions.trim().length > 0 || purpose.trim().length > 0;
    if (step === 2) return tools.length > 0;
    return true;
  };

  const save = () => {
    const s = loadOperatorState();
    if (!s.user || !name.trim()) return;
    setSaving(true);
    const agent = createAgent({
      userId: s.user.id,
      name,
      description,
      purpose,
      instructions: instructions || purpose,
      expectedOutput,
      constraints,
      templateType,
      tools,
      permissions: {
        mode: permMode,
        allowDestructive,
      },
      schedule: {
        ...defaultSchedule(),
        frequency,
        time,
        timezone,
        dayOfWeek,
        dayOfMonth,
        enabled: true,
      },
    });
    router.push(`/agents/${agent.id}`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Create agent</h1>
        <div className="mt-3 flex flex-wrap gap-1">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`rounded-full px-2.5 py-1 text-[11px] ${
                i === step
                  ? "bg-indigo-600 text-white"
                  : i < step
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <Field label="Agent name" value={name} onChange={setName} placeholder="Market research agent" />
          <Field label="Purpose" value={purpose} onChange={setPurpose} textarea placeholder="What should this agent accomplish?" />
          <Field label="Description (optional)" value={description} onChange={setDescription} textarea />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Instructions" value={instructions} onChange={setInstructions} textarea placeholder="What the agent should do…" />
          <Field label="Expected output" value={expectedOutput} onChange={setExpectedOutput} textarea />
          <Field label="Constraints" value={constraints} onChange={setConstraints} textarea placeholder="What not to do" />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500">Only available tools can be selected.</p>
          {availableTools.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTool(t.id)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                tools.includes(t.id)
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <span
                className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
                  tools.includes(t.id) ? "border-indigo-600 bg-indigo-600" : "border-zinc-300"
                }`}
              />
              <div>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-zinc-500">{t.description} · {t.connector}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Frequency</span>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="once">Run once (manual)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          {frequency !== "once" && (
            <>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Time</span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
              {frequency === "weekly" && (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Day of week</span>
                  <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                    {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d, i) => (
                      <option key={d} value={i}>{d}</option>
                    ))}
                  </select>
                </label>
              )}
              {frequency === "monthly" && (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Day of month</span>
                  <input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                </label>
              )}
              <p className="text-xs text-zinc-500">Timezone: {timezone}. Use Run now anytime.</p>
            </>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Permission mode</span>
            <select value={permMode} onChange={(e) => setPermMode(e.target.value as PermissionMode)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="read">Read-only</option>
              <option value="write">Create / write allowed</option>
              <option value="approval_required">Approval required for writes</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowDestructive} onChange={(e) => setAllowDestructive(e.target.checked)} />
            Allow destructive actions — off by default
          </label>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div><div className="text-xs text-zinc-500">Name</div><div>{name}</div></div>
          <div><div className="text-xs text-zinc-500">Purpose</div><div>{purpose}</div></div>
          <div><div className="text-xs text-zinc-500">Tools</div><div>{tools.join(", ")}</div></div>
          <div><div className="text-xs text-zinc-500">Schedule</div><div className="capitalize">{frequency}{frequency !== "once" ? ` at ${time}` : ""}</div></div>
          <div><div className="text-xs text-zinc-500">Permissions</div><div>{permMode}</div></div>
        </div>
      )}

      <div className="flex justify-between gap-2">
        <button type="button" onClick={() => (step === 0 ? router.push("/agents") : setStep(step - 1))} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
          {step === 0 ? "Cancel" : "Back"}
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" disabled={!canNext()} onClick={() => setStep(step + 1)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40">
            Continue
          </button>
        ) : (
          <button type="button" disabled={saving || !name.trim()} onClick={save} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40">
            {saving ? "Saving…" : "Create agent"}
          </button>
        )}
      </div>
    </div>
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
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900" />
      )}
    </label>
  );
}

export default function NewAgentPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Loading…</div>}>
        <NewAgentForm />
      </Suspense>
    </AppShell>
  );
}
