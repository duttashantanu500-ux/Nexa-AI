"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createAgent, loadOperatorState } from "@/lib/operatorStore";

const TOOL_OPTIONS = [
  "Web Research",
  "Browser",
  "Email",
  "Google Drive",
  "Calendar",
  "Custom MCP",
];

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [instructions, setInstructions] = useState("");
  const [tools, setTools] = useState<string[]>(["Web Research"]);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) router.replace("/signup");
  }, [router]);

  const toggle = (t: string) => {
    setTools((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const save = () => {
    const s = loadOperatorState();
    if (!s.user || !name.trim() || !purpose.trim()) return;
    createAgent({
      userId: s.user.id,
      name,
      purpose,
      instructions,
      tools,
    });
    router.push("/agents");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-8 space-y-5">
        <h1 className="text-xl font-semibold tracking-tight">Create agent</h1>

        <Field label="Agent name" value={name} onChange={setName} placeholder="Lead Researcher" />
        <Field
          label="What should this agent accomplish?"
          value={purpose}
          onChange={setPurpose}
          textarea
        />
        <Field
          label="Instructions"
          value={instructions}
          onChange={setInstructions}
          textarea
          placeholder="Optional guidance for how it should work"
        />

        <div className="space-y-2">
          <div className="text-sm font-medium">Tools</div>
          <div className="flex flex-wrap gap-2">
            {TOOL_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggle(t)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  tools.includes(t)
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-border text-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            Connections and MCP execution are UI-ready only in Part 1.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/agents")}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!name.trim() || !purpose.trim()}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save agent
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </div>
  );
}
