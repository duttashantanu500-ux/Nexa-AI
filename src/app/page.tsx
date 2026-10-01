"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadOperatorState } from "@/lib/operatorStore";
import { NexaLogo } from "@/components/NexaLogo";

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
        <NexaLogo size={28} href="/" />
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/login"
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
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

      <main className="mx-auto max-w-5xl px-4 pb-20 pt-10 md:pt-16">
        <section className="space-y-6">
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            The operating system for AI agents
          </h1>
          <p className="max-w-xl text-base text-zinc-600 dark:text-zinc-400 md:text-lg">
            Nexa is the place to create AI agents that use the apps you already
            work in — so routine work runs itself.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Start free
            </Link>
            <Link
              href="/plans"
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              See plans
            </Link>
          </div>
        </section>

        <section className="mt-16 space-y-4">
          <h2
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            What you can do
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Connect your tools",
                body: "Notion, Slack, Buffer, Ideogram, Vault, and more — agents work where you already do.",
              },
              {
                title: "Build agents",
                body: "Describe the job. Nexa turns it into steps agents can run, with approvals when needed.",
              },
              {
                title: "Run and schedule",
                body: "Run once or on a schedule. See history, outputs, and what still needs your attention.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="text-sm font-semibold">{c.title}</div>
                <p className="mt-2 text-sm text-zinc-500">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 space-y-4">
          <h2
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            Built for real work
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Vault",
                body: "Keep private files agents can search and use securely.",
              },
              {
                title: "Approvals",
                body: "Sensitive actions wait for you before they run.",
              },
              {
                title: "Run history",
                body: "See what ran, what failed, and what needs a retry.",
              },
              {
                title: "Free and Pro",
                body: "Start free. Upgrade when you need higher limits.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="text-sm font-semibold">{c.title}</div>
                <p className="mt-2 text-sm text-zinc-500">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 space-y-4">
          <h2
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            Plans
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-sm font-semibold">Free</div>
              <div className="mt-1 text-2xl font-semibold">$0</div>
              <p className="mt-2 text-sm text-zinc-500">
                For getting started with agents and core connections.
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
              <div className="text-sm font-semibold">Pro</div>
              <div className="mt-1 text-2xl font-semibold">$9/mo</div>
              <p className="mt-2 text-sm text-zinc-500">
                Higher limits for agents, runs, connections, and Vault.
              </p>
            </div>
          </div>
          <Link href="/plans" className="text-sm text-indigo-600 hover:underline">
            Compare Free and Pro →
          </Link>
        </section>

        <section className="mt-16 rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold tracking-tight">Start free</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Create your account, connect a tool, and build your first agent in
            minutes.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Create account
          </Link>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
          <p>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Nexa</span>
            {" — "}AI Agent Operating System
          </p>
          <div className="flex gap-4">
            <Link href="/plans">Plans</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Sign up</Link>
          </div>
          <p>© {new Date().getFullYear()} Nexa</p>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Nexa",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description:
              "Nexa is an AI agent operating system for connecting tools, building agents, and running workflows.",
            url: "https://www.nexaiintelligence.online",
          }),
        }}
      />
    </div>
  );
}
