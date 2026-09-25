"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadOperatorState } from "@/lib/operatorStore";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const state = loadOperatorState();
    if (state.user?.onboardingCompleted) {
      router.replace("/home");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="text-sm font-semibold tracking-tight text-indigo-600 dark:text-indigo-400">
          Nexa
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        <section className="pt-16 pb-20 md:pt-24">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            AI Agent Operating System
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight leading-[1.1] md:text-5xl">
            Create agents that run your workflows
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Give each agent instructions, tools, permissions, and a schedule.
            Nexa runs the work and shows results in the agent&apos;s history.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Create your first agent
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-14 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              { t: "Create", d: "Name, instructions, tools" },
              { t: "Schedule", d: "Once, daily, weekly, monthly" },
              { t: "Run", d: "Execute and review results" },
            ].map((s) => (
              <div
                key={s.t}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="text-sm font-medium">{s.t}</div>
                <p className="mt-1 text-xs text-zinc-500">{s.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
