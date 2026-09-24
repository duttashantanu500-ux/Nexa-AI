"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadOperatorState, setUser } from "@/lib/operatorStore";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState("");

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

  const submit = () => {
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
      onboardingCompleted: true,
    });
    router.replace("/home");
  };

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
            placeholder="Hnjaj"
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
          onClick={submit}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white"
        >
          Continue to Nexa
        </button>
      </div>
    </div>
  );
}
