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
    if (!s.user) return;
    setUser({
      ...s.user,
      name: n,
      age: a,
    });
    setStep("plan");
  };

  const finishFree = () => {
    const s = loadOperatorState();
    if (!s.user) return;
    setUser({
      ...s.user,
      onboardingCompleted: true,
      plan: "free",
    });
    router.replace("/home");
  };

  const finishPro = async () => {
    setUpgrading(true);
    setError("");
    const s = loadOperatorState();
    if (!s.user) {
      setUpgrading(false);
      return;
    }
    setUser({
      ...s.user,
      onboardingCompleted: true,
    });
    const r = await startProCheckout();
    setUpgrading(false);
    if (r.ok && r.checkoutUrl) {
      window.location.href = r.checkoutUrl;
      return;
    }
    setError(r.message || "Could not start checkout. You can upgrade later from Plans.");
    router.replace("/home");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6">
        {step === "profile" && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Welcome to Nexa
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Build your AI team. A few details to get started.
              </p>
            </div>
            <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="Your name"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="13+"
                  min={13}
                  max={120}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="button"
                onClick={submitProfile}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "plan" && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Choose how to start
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Your workspace is ready. Connect your tools, hire your first AI employee,
                and grow from there.
              </p>
            </div>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={finishFree}
                className="rounded-xl border border-zinc-200 bg-white p-5 text-left hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">Start free</div>
                <p className="mt-1 text-sm text-zinc-500">
                  Up to {PLAN_FREE.limits.maxAgents} AI employees · {PLAN_FREE.limits.maxRunsPerMonth}{" "}
                  work runs/month
                </p>
              </button>
              <button
                type="button"
                disabled={upgrading}
                onClick={() => void finishPro()}
                className="rounded-xl border border-indigo-300 bg-indigo-50/50 p-5 text-left dark:border-indigo-800 dark:bg-indigo-950/30"
              >
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {upgrading ? "Opening checkout…" : "Upgrade to Pro — $9/mo"}
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Up to {PLAN_PRO.limits.maxAgents} AI employees · {PLAN_PRO.limits.maxRunsPerMonth}{" "}
                  work runs/month
                </p>
              </button>
            </div>
            {error && <p className="text-center text-sm text-red-500">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
