"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadOperatorState, setUser } from "@/lib/operatorStore";
import { PLAN_FREE, PLAN_PRO } from "@/lib/plans";
import { startProCheckout } from "@/lib/clientBilling";
import { syncProfileToCloud } from "@/lib/auth";
import { persistUserProfile } from "@/lib/sessionUser";
import {
  ROLE_TEMPLATES,
  getRoleTemplate,
  type RoleTemplate,
  type RoleTemplateId,
} from "@/lib/roleTemplates";

type Step = "profile" | "goals" | "recommend" | "plan";

type GoalId = RoleTemplateId | "general";

const GOALS: { id: GoalId; label: string; blurb: string }[] = [
  {
    id: "marketing",
    label: "Marketing & growth",
    blurb: "Campaigns, content drafts, social updates",
  },
  {
    id: "research",
    label: "Research & reporting",
    blurb: "Briefs, structured findings, written reports",
  },
  {
    id: "sales",
    label: "Sales & CRM",
    blurb: "Pipeline hygiene, deal summaries, follow-ups",
  },
  {
    id: "operations",
    label: "Operations & admin",
    blurb: "Checklists, status notes, team updates",
  },
  {
    id: "general",
    label: "General productivity",
    blurb: "Flexible help across notes and tools",
  },
];

const CONTEXTS = [
  { id: "solo", label: "Solo / founder" },
  { id: "small", label: "Small business" },
  { id: "team", label: "Managing a team" },
] as const;

const ONBOARD_ROLE_KEY = "nexa_onboard_role";

function recommendRole(goal: GoalId | ""): RoleTemplate {
  if (goal && goal !== "general") {
    const t = getRoleTemplate(goal);
    if (t) return t;
  }
  return ROLE_TEMPLATES.find((t) => t.id === "research") || ROLE_TEMPLATES[0];
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [goal, setGoal] = useState<GoalId | "">("");
  const [context, setContext] = useState<string>("");
  const [error, setError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  const recommended = useMemo(() => recommendRole(goal), [goal]);

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
    if (!n) {
      setError("Please enter your name.");
      return;
    }
    // Age is optional for speed; validate only if provided
    let ageVal: number | undefined;
    if (age.trim()) {
      const a = parseInt(age, 10);
      if (Number.isNaN(a) || a < 13 || a > 120) {
        setError("Please enter a valid age (13+), or leave it blank.");
        return;
      }
      ageVal = a;
    }
    const s = loadOperatorState();
    if (!s.user) return;
    const next = {
      ...s.user,
      name: n,
      ...(ageVal !== undefined ? { age: ageVal } : {}),
    };
    setUser(next);
    persistUserProfile(next);
    void syncProfileToCloud(next);
    setStep("goals");
  };

  const submitGoals = () => {
    setError("");
    setStep("recommend");
  };

  const skipGoals = () => {
    setGoal("");
    setContext("");
    setStep("recommend");
  };

  const completeAndGo = (path: string) => {
    const s = loadOperatorState();
    if (!s.user) return;
    const next = {
      ...s.user,
      onboardingCompleted: true,
      plan: (s.user.plan || "free") as "free" | "pro",
    };
    setUser(next);
    persistUserProfile(next);
    void syncProfileToCloud(next);
    try {
      sessionStorage.setItem(ONBOARD_ROLE_KEY, recommended.id);
    } catch {
      /* */
    }
    router.replace(path);
  };

  const finishFree = () => {
    const s = loadOperatorState();
    if (!s.user) return;
    const next = {
      ...s.user,
      onboardingCompleted: true,
      plan: "free" as const,
    };
    setUser(next);
    persistUserProfile(next);
    void syncProfileToCloud(next);
    try {
      sessionStorage.setItem(ONBOARD_ROLE_KEY, recommended.id);
    } catch {
      /* */
    }
    // Default: send to Hiring Desk with recommended role for first success
    router.replace(`/agents/new?role=${encodeURIComponent(recommended.id)}`);
  };

  const finishPro = async () => {
    setUpgrading(true);
    setError("");
    const s = loadOperatorState();
    if (!s.user) {
      setUpgrading(false);
      return;
    }
    const next = {
      ...s.user,
      onboardingCompleted: true,
    };
    setUser(next);
    persistUserProfile(next);
    void syncProfileToCloud(next);
    try {
      sessionStorage.setItem(ONBOARD_ROLE_KEY, recommended.id);
    } catch {
      /* */
    }
    const r = await startProCheckout();
    setUpgrading(false);
    if (r.ok && r.checkoutUrl) {
      window.location.href = r.checkoutUrl;
      return;
    }
    setError(
      r.message || "Could not start checkout. You can upgrade later from Plans."
    );
    router.replace(`/agents/new?role=${encodeURIComponent(recommended.id)}`);
  };

  const toolLabels = recommended.suggestedTools
    .filter((id) => id !== "local_data")
    .map((id) => {
      const map: Record<string, string> = {
        notion: "Notion",
        slack: "Slack",
        buffer: "Buffer",
        hubspot: "HubSpot",
      };
      return map[id] || id;
    });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-center gap-1.5">
          {(["profile", "goals", "recommend", "plan"] as Step[]).map((s, i) => {
            const order: Step[] = ["profile", "goals", "recommend", "plan"];
            const activeIdx = order.indexOf(step);
            const done = i < activeIdx;
            const current = i === activeIdx;
            return (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  current
                    ? "w-8 bg-indigo-600"
                    : done
                      ? "w-4 bg-indigo-400"
                      : "w-4 bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            );
          })}
        </div>

        {step === "profile" && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Welcome to Nexa
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Hire digital talent. Assign real work. Build your AI company.
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
                <label className="text-sm font-medium">
                  Age <span className="font-normal text-zinc-400">(optional)</span>
                </label>
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
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "goals" && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                What are you trying to accomplish?
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                We'll recommend a starting AI employee. You can change this later.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      goal === g.id
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:border-indigo-500 dark:bg-indigo-950/40"
                        : "border-zinc-200 bg-white hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
                    }`}
                  >
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {g.label}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">{g.blurb}</p>
                  </button>
                ))}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">
                  Context (optional)
                </p>
                <div className="flex flex-wrap gap-2">
                  {CONTEXTS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setContext((prev) => (prev === c.id ? "" : c.id))
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        context === c.id
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={submitGoals}
                  disabled={!goal}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  See recommendation
                </button>
                <button
                  type="button"
                  onClick={skipGoals}
                  className="w-full py-2 text-sm text-zinc-500 hover:text-indigo-600"
                >
                  Skip — I'll explore on my own
                </button>
              </div>
            </div>
          </>
        )}

        {step === "recommend" && (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Recommended AI employee
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Based on your goals. Hire this role next — or pick another later.
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm dark:border-indigo-900 dark:bg-zinc-900">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                {recommended.department}
              </div>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {recommended.jobTitle}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {recommended.summary}
              </p>
              <ul className="mt-4 space-y-1.5">
                {recommended.responsibilities.map((r) => (
                  <li
                    key={r}
                    className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                    {r}
                  </li>
                ))}
              </ul>
              {toolLabels.length > 0 && (
                <p className="mt-4 text-xs text-zinc-500">
                  Suggested tools:{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {toolLabels.join(", ")}
                  </span>
                  {" · "}Works with local notes even before you connect tools.
                </p>
              )}
              <p className="mt-2 text-[11px] text-zinc-400">
                {recommended.limitations}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setStep("plan")}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Continue with this role
              </button>
              <button
                type="button"
                onClick={() => setStep("goals")}
                className="w-full py-2 text-sm text-zinc-500 hover:text-indigo-600"
              >
                Choose a different goal
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
                Next we'll open the Hiring Desk with your{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {recommended.jobTitle}
                </span>{" "}
                ready to hire.
              </p>
            </div>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={finishFree}
                className="rounded-xl border border-zinc-200 bg-white p-5 text-left hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                  Start free
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Up to {PLAN_FREE.limits.maxAgents} AI employees ·{" "}
                  {PLAN_FREE.limits.maxRunsPerMonth} work runs/month
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
                  Up to {PLAN_PRO.limits.maxAgents} AI employees ·{" "}
                  {PLAN_PRO.limits.maxRunsPerMonth} work runs/month
                </p>
              </button>
            </div>
            <button
              type="button"
              onClick={() => completeAndGo("/home")}
              className="w-full py-2 text-center text-sm text-zinc-500 hover:text-indigo-600"
            >
              Skip hiring for now — go to Home
            </button>
            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}
            <p className="text-center text-[11px] text-zinc-400">
              You can always open{" "}
              <Link href="/plans" className="underline hover:text-indigo-600">
                Plans
              </Link>{" "}
              later.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
