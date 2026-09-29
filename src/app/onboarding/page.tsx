"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadOperatorState, setUser } from "@/lib/operatorStore";
import { PLAN_FREE, PLAN_PRO } from "@/lib/plans";
import { startProCheckout } from "@/lib/clientBilling";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"profile" | "plan">("profile");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user) {
      router.replace("/signup");
      return;
    }
    if (s.user.onboardingCompleted) {
      router.replace("/home");
      return;
    }
    if (s.user.name) setName(s.user.name);
  }, [router]);

  const submitProfile = () => {
    setError("");
    const n = name.trim();
    const a = parseInt(age, 10);
    if (!n) {
      setError("Please enter your name.");
      return;
    }
    if (!age || Number.isNaN(a) || a < 13 || a > 120) {
      setError("Please enter a valid age (13+).");
      return;
    }
    const s = loadOperatorState();
    if (!s.user) {
      router.replace("/signup");
      return;
    }
    setUser({
      ...s.user,
      name: n,
      age: a,
      onboardingCompleted: false,
    });
    setStep("plan");
  };

  const finishFree = () => {
    const s = loadOperatorState();
    if (!s.user) {
      router.replace("/signup");
      return;
    }
    setUser({
      ...s.user,
      name: name.trim() || s.user.name,
      age: age ? parseInt(age, 10) : s.user.age,
      onboardingCompleted: true,
    });
    router.replace("/home");
  };

  const upgrade = async () => {
    setUpgrading(true);
    setError("");
    const s = loadOperatorState();
    if (s.user) {
      setUser({
        ...s.user,
        name: name.trim() || s.user.name,
        age: age ? parseInt(age, 10) : s.user.age,
        onboardingCompleted: true,
      });
    }
    const r = await startProCheckout();
    if (!r.ok) {
      setError(r.message);
      setUpgrading(false);
      return;
    }
    window.location.href = r.checkoutUrl;
  };

  if (step === "plan") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-lg space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <div className="text-lg font-semibold text-indigo-600">Nexa</div>
            <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              You're in. Welcome to Nexa.
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Your workspace is ready. Connect your tools, build your first agent,
              and let Nexa handle the work.
            </p>
            <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Current plan: Free
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-indigo-300 bg-indigo-50/40 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Free
              </div>
              <div className="text-xs text-zinc-500">{PLAN_FREE.priceLabel}</div>
              <ul className="mt-2 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                {PLAN_FREE.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Pro
              </div>
              <div className="text-xs text-zinc-500">{PLAN_PRO.priceLabel}</div>
              <ul className="mt-2 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                {PLAN_PRO.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={finishFree}
              className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white"
            >
              Start with Free
            </button>
            <button
              type="button"
              disabled={upgrading}
              onClick={() => void upgrade()}
              className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium dark:border-zinc-700 disabled:opacity-50"
            >
              {upgrading ? "Opening…" : "Upgrade to Pro"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <div className="text-lg font-semibold text-indigo-600">Nexa</div>
          <h1 className="mt-2 text-xl font-semibold">Welcome</h1>
          <p className="mt-1 text-sm text-zinc-500">
            A few details so we can personalize your workspace.
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="Your name"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Age</span>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="25"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={submitProfile}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
