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
  "Custom MCP",
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
        <section className="pb-14 pt-12 md:pb-16 md:pt-16">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            AI Agent Operating System
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Connect your tools. Build agents. Let them work.
          </h1>
          <p className="mt-4 max-w-lg text-base text-zinc-600 dark:text-zinc-400">
            Nexa is the place to create AI agents that use the apps you already
            have — with permissions, schedules, and clear results.
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

        <section className="pb-14" aria-labelledby="how-heading">
          <h2
            id="how-heading"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            How it works
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                t: "Connect your tools",
                d: "Notion, Slack, Buffer, Ideogram, Vault, MCP, and more.",
              },
              {
                t: "Create an agent",
                d: "Instructions, tools, permissions, and optional schedule.",
              },
              {
                t: "Let it handle the work",
                d: "Runs execute for real. Review history anytime.",
              },
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

        <section className="pb-14" aria-labelledby="pillars-heading">
          <h2
            id="pillars-heading"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            Core product
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { t: "Agents", d: "Build and run agents with clear tool access." },
              {
                t: "Connections",
                d: "Wire agents to the tools you already use.",
              },
              {
                t: "Vault",
                d: "Private files agents can use when you allow it.",
              },
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

        <section className="pb-14" aria-labelledby="tools-heading">
          <h2
            id="tools-heading"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            Connections
          </h2>
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

        <section className="pb-14" aria-labelledby="pricing-heading">
          <h2
            id="pricing-heading"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            Pricing
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-sm font-semibold">Free</div>
              <div className="mt-1 text-2xl font-semibold">$0</div>
              <p className="mt-1 text-xs text-zinc-500">
                3 agents · 100 runs/mo · 500 MB Vault
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
              <div className="text-sm font-semibold">Pro</div>
              <div className="mt-1 text-2xl font-semibold">$9/mo</div>
              <p className="mt-1 text-xs text-zinc-500">
                20 agents · 1,000 runs · 5 GB Vault
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/plans" className="text-sm text-indigo-600 hover:underline">
              View plans
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold tracking-tight">Start free</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Create an account and build your first agent in minutes.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Get started
          </Link>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Nexa</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/plans" className="hover:text-zinc-800">
              Plans
            </Link>
            <Link href="/signup" className="hover:text-zinc-800">
              Get started
            </Link>
            <a
              href="mailto:nexa.com.intelligence@gmail.com"
              className="hover:text-zinc-800"
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
