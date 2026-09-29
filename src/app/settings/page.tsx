"use client";

import { useEffect, useState } from "react";
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

  const planId = billing?.planId || "free";
  const isPro = planId === "pro";
  const maxAgents = billing?.limits.maxAgents ?? PLAN_FREE.limits.maxAgents;
  const maxConn = billing?.limits.maxConnections ?? PLAN_FREE.limits.maxConnections;
  const maxRuns = billing?.limits.maxRunsPerMonth ?? PLAN_FREE.limits.maxRunsPerMonth;
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
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Email</span>
            <input
              value={email}
              disabled
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Age</span>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Plan
          </h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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

            <ul className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <li>
                Agents: {usage.agents} / {maxAgents}
              </li>
              <li>
                Connections:{" "}
                {maxConn === Number.POSITIVE_INFINITY
                  ? `${usage.connections} · Unlimited`
                  : `${usage.connections} / ${maxConn}`}
              </li>
              <li>
                Agent runs: {runsUsed} / {maxRuns}
              </li>
              <li>
                Vault: {formatSize(usage.vaultBytes)} /{" "}
                {vaultLimit >= 1024 * 1024 * 1024
                  ? `${(vaultLimit / (1024 * 1024 * 1024)).toFixed(0)} GB`
                  : `${(vaultLimit / (1024 * 1024)).toFixed(0)} MB`}
              </li>
            </ul>

            {!isPro && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-zinc-500">
                  Upgrade to Pro for more agents, unlimited connections, 1,000
                  runs/month, 5 GB Vault, and advanced workflow options.
                </p>
                <button
                  type="button"
                  disabled={billingBusy}
                  onClick={() => void upgrade()}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {billingBusy ? "Opening checkout…" : "Upgrade to Pro — $9/month"}
                </button>
              </div>
            )}

            {isPro && (
              <p className="mt-3 text-xs text-zinc-500">
                To change or cancel, use the receipt from checkout. Pro stays
                active until the end of the billing period if you cancel.
              </p>
            )}

            <button
              type="button"
              disabled={billingBusy}
              onClick={() => void refreshPlan()}
              className="mt-3 text-xs text-indigo-600 hover:underline disabled:opacity-50"
            >
              Refresh plan status
            </button>

            {billingMsg && (
              <p className="mt-3 text-xs text-indigo-600 dark:text-indigo-400">
                {billingMsg}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={`rounded-xl border p-3 ${
                !isPro
                  ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Free
              </div>
              <div className="text-xs text-zinc-500">$0/month</div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                {PLAN_FREE.features.slice(0, 5).map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
            <div
              className={`rounded-xl border p-3 ${
                isPro
                  ? "border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Pro
              </div>
              <div className="text-xs text-zinc-500">$9/month</div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                {PLAN_PRO.features.slice(0, 6).map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Theme
          </h2>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => changeTheme(t)}
                className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                  theme === t
                    ? "bg-indigo-600 text-white"
                    : "border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Light forces a bright background and dark text. Dark forces dark UI.
            System follows your device.
          </p>
        </section>

        <section>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 dark:border-red-900"
          >
            Log out
          </button>
        </section>
      </div>
    </AppShell>
  );
}
