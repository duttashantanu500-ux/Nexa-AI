"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState, updateBusinessProfile } from "@/lib/operatorStore";
import { BusinessContext } from "@/types";

export default function BrainPage() {
  const router = useRouter();
  const [form, setForm] = useState<BusinessContext>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setForm(s.businessContext || {});
  }, [router]);

  const set = (key: keyof BusinessContext, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    updateBusinessProfile(form);
    setSaved(true);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Business Brain</h1>
          <p className="text-sm text-muted">
            Shared context Nexa will use across missions and agents.
          </p>
        </div>

        <Section title="Business">
          <Field label="Business name" value={form.businessName || ""} onChange={(v) => set("businessName", v)} />
          <Field label="Business type" value={form.businessType || ""} onChange={(v) => set("businessType", v)} />
          <Field label="Industry" value={form.industry || ""} onChange={(v) => set("industry", v)} />
          <Field label="Description" value={form.description || form.whatBuilding || ""} onChange={(v) => set("description", v)} textarea />
        </Section>

        <Section title="Customers">
          <Field
            label="Target audience"
            value={form.targetCustomer || form.targetCustomers || form.targetClients || ""}
            onChange={(v) => set("targetCustomers", v)}
          />
          <Field label="Location / market" value={form.location || ""} onChange={(v) => set("location", v)} />
        </Section>

        <Section title="Goals">
          <Field label="Main business goal" value={form.mainGoal || ""} onChange={(v) => set("mainGoal", v)} textarea />
          <Field label="Current priorities" value={form.biggestChallenge || ""} onChange={(v) => set("biggestChallenge", v)} textarea />
        </Section>

        <Section title="Website">
          <Field label="Website URL" value={form.website || ""} onChange={(v) => set("website", v)} />
          <Field label="Website summary" value={form.websiteSummary || ""} onChange={(v) => set("websiteSummary", v)} textarea />
        </Section>

        <Section title="Brand">
          <Field label="Brand voice" value={form.brandVoice || ""} onChange={(v) => set("brandVoice", v)} textarea />
          <Field label="Preferences" value={form.preferences || ""} onChange={(v) => set("preferences", v)} textarea />
        </Section>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save
          </button>
          {saved && <span className="text-xs text-muted">Saved</span>}
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted uppercase tracking-wider">{title}</h2>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </div>
  );
}
