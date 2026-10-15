"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadOperatorState } from "@/lib/operatorStore";
import { NexaLogo } from "@/components/NexaLogo";
import { RobotHeroScene } from "@/components/robots/RobotHeroScene";
import { RobotAvatar } from "@/components/robots/RobotAvatar";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const state = loadOperatorState();
    if (state.user?.onboardingCompleted) {
      router.replace("/home");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
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
            className="rounded-xl bg-indigo-600 px-3.5 py-2 text-white shadow-sm shadow-indigo-600/25 hover:bg-indigo-500"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 md:pt-10">
        <section className="grid items-center gap-10 md:grid-cols-2 md:gap-8">
          <div className="nexa-enter space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              AI employees · AI team · AI agents
            </div>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight md:text-5xl lg:text-[3.25rem]">
              Nexa — hire AI employees and build your AI team
            </h1>
            <p className="max-w-lg text-base text-zinc-600 dark:text-zinc-400 md:text-lg">
              Nexa is an AI employee platform. Create AI agents that connect to
              Notion, Slack, HubSpot, and Buffer — then assign real work with
              approvals, schedules, and a shared Work Board.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-500"
              >
                Hire your first AI employee
              </Link>
              <Link
                href="/plans"
                className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                See plans
              </Link>
            </div>
          </div>
          <RobotHeroScene />
        </section>

        <section className="mt-20 space-y-6" aria-labelledby="how-nexa-works">
          <h2
            id="how-nexa-works"
            className="text-sm font-semibold uppercase tracking-wide text-zinc-400"
          >
            How Nexa works
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                avatar: "moss" as const,
                title: "Connect your tools",
                body: "Notion, Slack, Buffer, HubSpot, Vault, and more — your AI team works where you already do.",
              },
              {
                avatar: "violet" as const,
                title: "Build your AI team",
                body: "Describe the role. Nexa turns it into steps your AI employees and AI agents can run, with approvals when needed.",
              },
              {
                avatar: "ember" as const,
                title: "Run and schedule",
                body: "Run once or on a schedule. Track every AI agent on the Work Board — history, outputs, and what needs you.",
              },
            ].map((card) => (
              <div key={card.title} className="nexa-card p-5">
                <RobotAvatar id={card.avatar} size="sm" className="mb-3" />
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 space-y-4" aria-labelledby="what-is-nexa">
          <h2
            id="what-is-nexa"
            className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            What is Nexa?
          </h2>
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <p>
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">
                Nexa
              </strong>{" "}
              is a digital workforce platform for hiring and managing{" "}
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">
                AI employees
              </strong>
              . Each AI employee is an AI agent you configure once — role,
              tools, and workflow — then reuse for ongoing work instead of
              starting from scratch every time.
            </p>
            <p>
              Build an{" "}
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">
                AI team
              </strong>{" "}
              for research, marketing, sales, or operations. Connect the tools
              your company already uses. Nexa runs the steps, asks for approval
              when something is sensitive, and keeps a clear work history.
            </p>
            <p>
              Whether you search for an AI agent platform, AI team software, or
              a place to hire AI employees, Nexa is built for founders and
              operators who want real work done — not another chat demo.
            </p>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-2">
          <div className="nexa-card p-6">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Free
            </div>
            <div className="mt-1 text-2xl font-semibold">$0</div>
            <p className="mt-2 text-sm text-zinc-500">
              Up to 3 AI employees, core connections, and monthly work runs.
            </p>
          </div>
          <div className="nexa-card border-indigo-200 bg-indigo-50/40 p-6 dark:border-indigo-900 dark:bg-indigo-950/30">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Pro
            </div>
            <div className="mt-1 text-2xl font-semibold">$9/mo</div>
            <p className="mt-2 text-sm text-zinc-500">
              Higher limits for AI employees, work runs, connections, and Vault.
            </p>
            <Link
              href="/plans"
              className="mt-3 inline-block text-sm text-indigo-600 hover:underline"
            >
              Compare Free and Pro →
            </Link>
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-4 flex justify-center gap-2">
            <RobotAvatar id="cobalt" size="sm" />
            <RobotAvatar id="pearl" size="sm" />
            <RobotAvatar id="sun" size="sm" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            Start your AI team free
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Create your Nexa account, connect a tool, and hire your first AI
            employee in minutes.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500"
          >
            Create account
          </Link>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
          <p>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Nexa
            </span>
            {" — "}AI employees & AI team platform
          </p>
          <nav className="flex gap-4" aria-label="Footer">
            <Link href="/plans">Plans</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Sign up</Link>
          </nav>
          <p>© {new Date().getFullYear()} Nexa</p>
        </div>
      </footer>
    </div>
  );
}
