"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadAppState } from "@/lib/conversationStore";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const state = loadAppState();
    if (state.user?.onboardingCompleted) {
      router.replace("/home");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="text-sm font-semibold tracking-tight">Nexa</div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-muted hover:text-foreground">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Start Building
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        {/* Hero */}
        <section className="pt-16 pb-20 md:pt-24 md:pb-28">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-4">
            AI Business Operator
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl leading-[1.1]">
            Your AI Business Operator
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted leading-relaxed">
            Give Nexa a business goal. It plans the work, executes what it can, and
            delivers the result.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Start Building
            </Link>
            <a
              href="#how"
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-sidebar"
            >
              See How It Works
            </a>
          </div>

          {/* Product preview */}
          <div className="mt-14 max-w-lg rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="text-xs text-muted mb-1">Mission</div>
            <div className="text-sm font-medium mb-4">Find 50 potential customers</div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-emerald-600">✓</span> Researching market
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600">✓</span> Finding companies
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600">✓</span> Qualifying prospects
              </li>
              <li className="flex items-center gap-2 text-muted">
                <span>⏳</span> Preparing personalized outreach
              </li>
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-border py-16">
          <h2 className="text-xl font-semibold tracking-tight mb-8">How Nexa works</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                n: "1",
                t: "Give Nexa a goal",
                d: "Tell Nexa what you want accomplished.",
              },
              {
                n: "2",
                t: "Nexa creates a plan",
                d: "It breaks the goal into actionable steps.",
              },
              {
                n: "3",
                t: "Nexa works",
                d: "Nexa uses available tools and executes the task.",
              },
              {
                n: "4",
                t: "You get the result",
                d: "Receive a completed deliverable, report, list, or action plan.",
              },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-border bg-card p-5">
                <div className="text-xs text-muted mb-2">Step {s.n}</div>
                <div className="font-medium">{s.t}</div>
                <p className="mt-1 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Example missions */}
        <section className="border-t border-border py-16">
          <h2 className="text-xl font-semibold tracking-tight mb-2">Example missions</h2>
          <p className="text-sm text-muted mb-8">
            Illustrations of the product concept. Full autonomous execution ships in later phases.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                t: "Lead Research",
                d: "Find qualified potential customers.",
              },
              {
                t: "Competitor Monitor",
                d: "Track meaningful changes from competitors.",
              },
              {
                t: "Content Research",
                d: "Research trends and prepare content opportunities.",
              },
              {
                t: "Market Research",
                d: "Research a market and summarize opportunities.",
              },
            ].map((m) => (
              <div key={m.t} className="rounded-xl border border-border bg-card p-5">
                <div className="font-medium">{m.t}</div>
                <p className="mt-1 text-sm text-muted">{m.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border py-16 text-center">
          <h2 className="text-xl font-semibold">Ready to put Nexa to work?</h2>
          <p className="mt-2 text-sm text-muted">
            You give the goal. Nexa handles the work.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Start Building
          </Link>
        </section>
      </main>
    </div>
  );
}
