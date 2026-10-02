"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState, saveOperatorState } from "@/lib/operatorStore";
import { persistUserProfile } from "@/lib/sessionUser";

const STEPS = [
  {
    title: "Welcome to Nexa",
    body: "Nexa is where you build your AI team — hire AI employees, connect their tools, and let them handle the work.",
  },
  {
    title: "Connect your tools",
    body: "Link Notion, Slack, Buffer, Ideogram, and more so your AI employees can work where you already do.",
  },
  {
    title: "Hire your first AI employee",
    body: "Describe a role. Nexa proposes a workflow. You confirm before anything goes live.",
  },
  {
    title: "You're ready",
    body: "Your workspace is ready. Connect your tools, hire your first AI employee, and start building your team.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.id) {
      router.replace("/signup");
      return;
    }
    if (s.user.onboardingCompleted) {
      router.replace("/home");
      return;
    }
    setName(s.user.name || "");
  }, [router]);

  const finish = () => {
    const s = loadOperatorState();
    if (!s.user) {
      router.replace("/signup");
      return;
    }
    const user = {
      ...s.user,
      name: name.trim() || s.user.name || "",
      onboardingCompleted: true,
    };
    saveOperatorState({ ...s, user });
    persistUserProfile({
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType || "founder",
      createdAt: user.createdAt || new Date().toISOString(),
      onboardingCompleted: true,
    });
    router.replace("/home");
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {current.title}
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{current.body}</p>
        </div>

        {step === 0 && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">What should we call you?</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Your name"
            />
          </div>
        )}

        <div className="flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm dark:border-zinc-700"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (isLast) finish();
              else setStep((s) => s + 1);
            }}
            className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white"
          >
            {isLast ? "Go to Home" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
