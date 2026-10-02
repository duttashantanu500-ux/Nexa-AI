"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  clearSession,
  loadOperatorState,
  setTheme,
  setUser,
} from "@/lib/operatorStore";
import { applyTheme, type ThemeChoice } from "@/lib/theme";
import {
  fetchBillingStatus,
  startProCheckout,
  clearBillingCache,
  getConnectedExternalCount,
  type ClientBillingState,
} from "@/lib/clientBilling";
import { totalVaultBytes, formatSize } from "@/lib/vaultStore";
import { PLAN_FREE, PLAN_PRO } from "@/lib/plans";

export default function SettingsPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [theme, setThemeLocal] = useState<ThemeChoice>("light");
  const [saved, setSaved] = useState(false);
  const [billing, setBilling] = useState<ClientBillingState | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingMsg, setBillingMsg] = useState("");
  const [usage, setUsage] = useState({
    agents: 0,
    connections: 0,
    vaultBytes: 0,
  });
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportDesc, setSupportDesc] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportMsg, setSupportMsg] = useState("");
  const [supportErr, setSupportErr] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setName(s.user.name || "");
    setEmail(s.user.email || "");
    setAge(s.user.age != null ? String(s.user.age) : "");
    const t = (s.theme || "light") as ThemeChoice;
    setThemeLocal(t);
    applyTheme(t);

    const agents = s.agents.filter((a) => a.userId === s.user!.id).length;
    const vaultBytes = totalVaultBytes(s.user.id);
    setUsage((u) => ({ ...u, agents, vaultBytes }));

    void (async () => {
      const b = await fetchBillingStatus(true);
      setBilling(b);
      const connections = await getConnectedExternalCount(s.user!.id);
      setUsage((u) => ({ ...u, connections }));
    })();
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success") {
      clearBillingCache();
      void fetchBillingStatus(true).then((b) => {
        setBilling(b);
        setBillingMsg(
          b.planId === "pro"
            ? "You're on Pro. Enjoy the extra capacity."
            : "We're confirming your Pro access. This usually takes a moment — refresh if it doesn't update."
        );
      });
    }
  }, []);

  const saveProfile = () => {
    const s = loadOperatorState();
    if (!s.user) return;
    setUser({
      ...s.user,
      name: name.trim() || s.user.name,
      age: age ? parseInt(age, 10) : s.user.age,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const changeTheme = (t: ThemeChoice) => {
    setThemeLocal(t);
    setTheme(t);
    applyTheme(t);
  };

  const logout = () => {
    clearSession();
    clearBillingCache();
    router.replace("/login");
  };

  const upgrade = async () => {
    setBillingBusy(true);
    setBillingMsg("");
    const result = await startProCheckout();
    setBillingBusy(false);
    if (!result.ok) {
      setBillingMsg(result.message);
      return;
    }
    window.location.href = result.checkoutUrl;
  };

  const refreshPlan = async () => {
    setBillingBusy(true);
    clearBillingCache();
    const b = await fetchBillingStatus(true);
    setBilling(b);
    setBillingBusy(false);
    setBillingMsg(
      b.planId === "pro"
        ? "You're on Pro."
        : "Still on Free. If you just paid, wait a moment and try again."
    );
  };

  const submitSupport = async () => {
    setSupportBusy(true);
    setSupportMsg("");
    setSupportErr(false);
    const s = loadOperatorState();
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: supportSubject,
          description: supportDesc,
          userEmail: s.user?.email || email,
          userName: s.user?.name || name,
          userId: s.user?.id || "",
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSupportErr(true);
        setSupportMsg(data.message || "Could not send. Please try again.");
        setSupportBusy(false);
        return;
      }
      if (data.mailto) {
        window.location.href = data.mailto;
      }
      setSupportMsg(
        "Your email app should open with the message ready. Send it to finish."
      );
      setSupportSubject("");
      setSupportDesc("");
    } catch {
      setSupportErr(true);
      setSupportMsg("Could not send. Please try again.");
    }
    setSupportBusy(false);
  };

  const planId = billing?.planId || "free";
  const isPro = planId === "pro";
  const maxAgents = billing?.limits.maxAgents ?? PLAN_FREE.limits.maxAgents;
  const maxConn =
    billing?.limits.maxConnections ?? PLAN_FREE.limits.maxConnections;
  const maxRuns =
    billing?.limits.maxRunsPerMonth ?? PLAN_FREE.limits.maxRunsPerMonth;
  const vaultLimit = billing?.limits.vaultBytes ?? PLAN_FREE.limits.vaultBytes;
  const runsUsed = billing?.runsUsedThisPeriod ?? 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-8 px-4 py-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Profile
          </h2>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Email</span>
            <input
              value={email}
              disabled
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Age</span>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="button"
            onClick={saveProfile}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          >
            {saved ? "Saved" : "Save profile"}
          </button>
        </section>

        <section id="plan" className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Plan
          </h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 coll dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Nexa {isPro ? "Pro" : "Free"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {isPro ? PLAN_PRO.priceLabel : PLAN_FREE.priceLabel}
                  {billing?.cancelAtPeriodEnd && billing.periodEnd
                    ? ` · Ends ${new Date(billing.periodEnd).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  isPro
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {isPro ? "Pro" : "Free"}
              </span>
            </div>

            <ul className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
              <li>
                AI employees: {usage.agents} / {maxAgents}
              </li>
              <li>
                Connections:{" "}
                {maxConn === Number.POSITIVE_INFINITY
                  ? `${usage.connections} · Unlimited`
                  : `${usage.connections} / ${maxConn}`}
              </li>
              <li>
                Work runs: {runsUsed} / {maxRuns}
              </li>
              <li>
                Vault: {formatSize(usage.vaultBytes)} /{" "}
                {vaultLimit >= 1024 * 1024 * 1024
                  ? `${(vaultLimit / (1024 * 1024 * 1024)).toFixed(0)} GB`
                  : `${(vaultLimit / (1024 * 1024)).toFixed(0)} MB`}
              </li>
            </ul>

            {billingMsg && (
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                {billingMsg}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {!isPro && (
                <button
                  type="button"
                  disabled={billingBusy}
                  onClick={() => void upgrade()}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {billingBusy ? "Opening…" : "Upgrade to Pro — $9/mo"}
                </button>
              )}
              <button
                type="button"
                disabled={billingBusy}
                onClick={() => void refreshPlan()}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Refresh plan
              </button>
              <Link
                href="/plans"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Compare plans
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Appearance
          </h2>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as ThemeChoice[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => changeTheme(t)}
                className={`rounded-lg px-3 py-2 text-sm capitalize ${
                  theme === t
                    ? "bg-indigo-600 text-white"
                    : "border border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Support
          </h2>
          {!supportOpen ? (
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
            >
              Contact support
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Subject</span>
                <input
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Description</span>
                <textarea
                  value={supportDesc}
                  onChange={(e) => setSupportDesc(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={supportBusy || !supportSubject.trim() || !supportDesc.trim()}
                  onClick={() => void submitSupport()}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {supportBusy ? "Sending…" : "Send"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSupportOpen(false);
                    setSupportMsg("");
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                >
                  Cancel
                </button>
              </div>
              {supportMsg && (
                <p
                  className={`text-xs ${
                    supportErr
                      ? "text-red-600"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {supportMsg}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
          >
            Sign out
          </button>
        </section>
      </div>
    </AppShell>
  );
}
