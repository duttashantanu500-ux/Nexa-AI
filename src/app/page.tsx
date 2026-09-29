"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadOperatorState } from "@/lib/operatorStore";

const CONNECTORS = [
  "Notion",
  "Slack",
  "Buffer",
  "Ideogram",
  "Vault",
  "MCP",
  "Gmail",
  "Drive",
  "Sheets",
  "Calendar",
];

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
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-[11px] font-bold text-white"
            aria-hidden
          >
            N
          </span>
          <span className="text-sm font-semibold tracking-tight text-indigo-600 dark:text-indigo-400">
            Nexa
          </span>
        </div>
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

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <section className="pt-14 pb-16 md:pt-20 md:pb-20">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            AI Agent Operating System
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight leading-[1.1] md:text-5xl">
            Agents that connect your tools and run the work
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Nexa is where you build AI agents, wire them to the apps you already
            use, and let them handle real workflows — with clear permissions,
            schedules, and run history.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="pb-16" aria-labelledby="how-heading">
          <h2
            id="how-heading"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            How Nexa works
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                t: "Connect",
                d: "Link Notion, Slack, Buffer, Ideogram, Vault, and your own MCP servers.",
              },
              {
                t: "Build agents",
                d: "Give each agent instructions, tools, permissions, and a schedule.",
              },
              {
                t: "Run & review",
                d: "Agents execute the work. You see results in run history.",
              },
            ].map((s) => (
              <div
                key={s.t}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {s.t}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-16" aria-labelledby="pillars-heading">
          <h2
            id="pillars-heading"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            Built for real work
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                t: "Agents",
                d: "Create, schedule, and run agents with clear instructions and tool access.",
              },
              {
                t: "Connections",
                d: "Wire agents to the tools you already pay for — no black-box integrations.",
              },
              {
                t: "Vault",
                d: "Private files your agents can search and use when you allow it.",
              },
            ].map((s) => (
              <div
                key={s.t}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {s.t}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-16" aria-labelledby="tools-heading">
          <h2
            id="tools-heading"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            Tools & connectors
          </h2>
          <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Start with the services you use every day. More connectors ship as
            they're ready.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {CONNECTORS.map((name) => (
              <li
                key={name}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                {name}
              </li>
            ))}
          </ul>
        </section>

        <section className="pb-16" aria-labelledby="pricing-heading">
          <h2
            id="pricing-heading"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            Simple pricing
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Free
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">$0</div>
              <p className="mt-1 text-xs text-zinc-500">per month</p>
              <ul className="mt-4 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <li>Up to 3 agents</li>
                <li>Up to 3 connections</li>
                <li>100 agent runs / month</li>
                <li>500 MB Vault</li>
              </ul>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Pro
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">$9</div>
              <p className="mt-1 text-xs text-zinc-500">per month</p>
              <ul className="mt-4 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <li>Up to 20 agents</li>
                <li>Unlimited connections</li>
                <li>1,000 agent runs / month</li>
                <li>5 GB Vault + advanced workflow</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Ready when you are
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Create a free account, connect a tool, and build your first agent in
            minutes.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium dark:border-zinc-700"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Nexa</span>
            <span>AI Agent Operating System</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/signup" className="hover:text-zinc-800 dark:hover:text-zinc-200">
              Get started
            </Link>
            <Link href="/login" className="hover:text-zinc-800 dark:hover:text-zinc-200">
              Sign in
            </Link>
            <a
              href="mailto:nexa.com.intelligence@gmail.com"
              className="hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Contact
            </a>
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
            url: "https://www.nexaiintelligence.online",
            description:
              "Nexa is an AI agent operating system for connecting tools, building agents, and running workflows.",
            offers: [
              {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                name: "Free",
              },
              {
                "@type": "Offer",
                price: "9",
                priceCurrency: "USD",
                name: "Pro",
              },
            ],
          }),
        }}
      />
    </div>
  );
}
