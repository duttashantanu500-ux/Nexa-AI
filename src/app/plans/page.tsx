"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import { startProCheckout } from "@/lib/clientBilling";

const FREE = [
  "Up to 3 Agents",
  "Up to 3 Connections",
  "100 Agent Runs/month",
  "Vault 500 MB",
  "Scheduling",
  "Agent Builder",
  "Run history",
];

const PRO = [
  "Up to 20 Agents",
  "Unlimited Connections",
  "1,000 Agent Runs/month",
  "Vault 5 GB",
  "Scheduling",
  "Agent Builder",
  "Run history",
  "Advanced workflow options",
  "Priority execution",
];

export default function PlansPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    setSignedIn(Boolean(s.user?.id));
  }, []);

  const upgrade = async () => {
    if (!signedIn) {
      router.push("/signup");
      return;
    }
    setBusy(true);
    setMsg("");
    const result = await startProCheckout();
    setBusy(false);
    if (!result.ok) {
      setMsg(result.message);
      return;
    }
    window.location.href = result.checkoutUrl;
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Plans
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Simple pricing. Start free. Upgrade when you need more capacity.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Free
            </h2>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              $0
              <span className="text-sm font-normal text-zinc-500">/month</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              {FREE.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-indigo-300 bg-indigo-50/40 p-6 dark:border-indigo-800 dark:bg-indigo-950/30">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Pro
            </h2>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              $9
              <span className="text-sm font-normal text-zinc-500">/month</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              {PRO.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={() => void upgrade()}
              className="mt-6 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Opening checkout…" : "Upgrade to Pro"}
            </button>
            {msg && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{msg}</p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-500">
          <Link href="/settings" className="text-indigo-600 hover:underline">
            Back to Settings
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
