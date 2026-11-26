"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { loadOperatorState } from "@/lib/operatorStore";
import { getStableUserId } from "@/lib/sessionUser";
import { MAX_COMPOSIO_CONNECTIONS } from "@/lib/plans";

type Toolkit = {
  slug: string;
  name: string;
  logo?: string;
  description?: string;
  categories?: string[];
};

type Account = {
  id: string;
  toolkit: string;
  status: string;
  isDisabled?: boolean;
};

function friendlyAppName(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "App";
  const map: Record<string, string> = {
    gmail: "Gmail",
    slack: "Slack",
    notion: "Notion",
    hubspot: "HubSpot",
    github: "GitHub",
    googledrive: "Google Drive",
    googlecalendar: "Google Calendar",
    buffer: "Buffer",
    outlook: "Outlook",
    jira: "Jira",
    linear: "Linear",
    asana: "Asana",
    trello: "Trello",
    discord: "Discord",
    twitter: "X",
    linkedin: "LinkedIn",
  };
  const key = s.toLowerCase().replace(/\s+/g, "");
  if (map[key]) return map[key];
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function friendlyStatus(status: string, isDisabled?: boolean): string {
  if (isDisabled) return "Paused";
  const s = String(status || "").toUpperCase();
  if (/ACTIVE|CONNECTED|SUCCESS|ENABLED/.test(s)) return "Connected";
  if (/EXPIRED|REVOKED/.test(s)) return "Needs reconnect";
  if (/FAILED|ERROR/.test(s)) return "Needs attention";
  if (/PENDING|INITIATED/.test(s)) return "Connecting…";
  return "Connected";
}

function friendlyError(msg: string): string {
  const m = String(msg || "");
  if (
    /couldn’t be authorized|could not be authorized|server key|update the server key|api[_ ]?key|not configured|COMPOSIO/i.test(
      m
    )
  ) {
    return "App connections aren’t available right now. Please try again later.";
  }
  if (/limit|slot|3 of 3|already have/i.test(m)) {
    return "You’ve used all 3 connection slots. Disconnect an app to free one.";
  }
  if (/sign in required|not signed in|session expired|no session/i.test(m)) {
    return "Sign in again, then try connecting the app.";
  }
  return (
    m
      .replace(/\bComposio\b/gi, "")
      .replace(/\bOAuth\b/gi, "")
      .replace(/\bAPI[_ ]?key\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || "Something went wrong. Please try again."
  );
}

export default function ConnectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState("");
  const [q, setQ] = useState("");
  const [toolkits, setToolkits] = useState<Toolkit[]>([]);
  const [totalApps, setTotalApps] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [used, setUsed] = useState(0);
  const [loadingCat, setLoadingCat] = useState(true);
  const [loadingAcc, setLoadingAcc] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  const refreshAccounts = useCallback(async (uid: string) => {
    setLoadingAcc(true);
    try {
      const res = await fetch(
        `/api/composio/connections?userId=${encodeURIComponent(uid)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      setConfigured(data.configured !== false);
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      setUsed(typeof data.used === "number" ? data.used : 0);
      if (data.error && data.configured === false) {
        setError(friendlyError(String(data.error)));
      }
    } catch {
      setAccounts([]);
    }
    setLoadingAcc(false);
  }, []);

  const loadCatalogue = useCallback(async (query: string) => {
    setLoadingCat(true);
    try {
      const res = await fetch(
        `/api/composio/toolkits?limit=2000&q=${encodeURIComponent(query)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setConfigured(false);
        setError(friendlyError(data.error || "Could not load apps."));
        setToolkits([]);
        setTotalApps(0);
      } else {
        const list = Array.isArray(data.toolkits) ? data.toolkits : [];
        setToolkits(list);
        setTotalApps(
          typeof data.total === "number" ? data.total : list.length
        );
        setError("");
        setConfigured(true);
      }
    } catch {
      setToolkits([]);
      setTotalApps(0);
      setError("Could not load apps. Please try again.");
    }
    setLoadingCat(false);
  }, []);

  useEffect(() => {
    const s = loadOperatorState();
    const uid = (s.user?.id || getStableUserId() || "").trim();
    if (!uid) {
      router.replace("/login");
      return;
    }
    if (s.user && !s.user.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
    setUserId(uid);
    void refreshAccounts(uid);
    void loadCatalogue("");
  }, [router, refreshAccounts, loadCatalogue]);

  useEffect(() => {
    const err = searchParams.get("error");
    const connected = searchParams.get("connected");
    if (err) setError(friendlyError(err));
    if (connected) {
      setBanner(
        `${friendlyAppName(connected)} connected. You can assign it to an AI employee anytime.`
      );
      if (userId) void refreshAccounts(userId);
    }
  }, [searchParams, userId, refreshAccounts]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadCatalogue(q.trim());
    }, 280);
    return () => clearTimeout(t);
  }, [q, loadCatalogue]);

  const remaining = Math.max(0, MAX_COMPOSIO_CONNECTIONS - used);

  const connect = async (slug: string) => {
    if (!userId || connecting) return;
    if (used >= MAX_COMPOSIO_CONNECTIONS) {
      setBanner(
        "You’ve used all 3 connection slots. Disconnect an app to free one."
      );
      return;
    }
    setConnecting(slug);
    setBanner("");
    setError("");
    // Nexa-owned entry URL — starts on your domain, then opens the app’s sign-in
    window.location.href = `/connect/${encodeURIComponent(slug)}?userId=${encodeURIComponent(userId)}`;
  };

  const disconnect = async (id: string) => {
    if (!userId || disconnecting) return;
    setDisconnecting(id);
    setError("");
    try {
      const res = await fetch("/api/composio/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, connectedAccountId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(friendlyError(data.error || "Could not disconnect."));
      } else {
        setBanner("Disconnected. That slot is free again.");
        await refreshAccounts(userId);
      }
    } catch {
      setError("Could not disconnect. Please try again.");
    }
    setDisconnecting(null);
  };

  const connectedSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) {
      if (/ACTIVE|CONNECTED|SUCCESS/i.test(a.status) && !a.isDisabled) {
        set.add(a.toolkit.toLowerCase());
      }
    }
    return set;
  }, [accounts]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <PageHeader
          page="connections"
          title="Connections"
          subtitle="Link the apps your AI employees may use. You can connect up to 3 accounts."
        />

        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              Connection slots
            </span>
            <span className="text-zinc-600 dark:text-zinc-300">
              {used} / {MAX_COMPOSIO_CONNECTIONS} used · {remaining} remaining
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Each connected app account uses one slot. Disconnecting frees a slot.
          </p>
        </div>

        {banner && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            {banner}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {error}
          </div>
        )}

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Your connected accounts
          </h2>
          {loadingAcc ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-zinc-500">
              None yet. Search below and connect an app.
            </p>
          ) : (
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {friendlyAppName(a.toolkit)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {friendlyStatus(a.status, a.isDisabled)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={disconnecting === a.id}
                    onClick={() => void disconnect(a.id)}
                    className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                  >
                    {disconnecting === a.id ? "…" : "Disconnect"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Available apps
              {!loadingCat && totalApps > 0 && (
                <span className="ml-2 font-normal normal-case tracking-normal text-zinc-400">
                  ({totalApps.toLocaleString()})
                </span>
              )}
            </h2>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search apps (Gmail, Slack, Notion…)"
              className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:w-64"
            />
          </div>

          {loadingCat ? (
            <p className="text-sm text-zinc-500">Loading apps…</p>
          ) : toolkits.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {!configured
                ? "Apps aren’t available right now. Please try again later."
                : "No apps matched. Try another search."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {toolkits.map((t) => {
                const connected = connectedSlugs.has(t.slug);
                const label = t.name || friendlyAppName(t.slug);
                return (
                  <div
                    key={t.slug}
                    className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-50 dark:bg-zinc-800">
                      {t.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.logo}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 object-contain"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <span className="text-xs font-semibold text-zinc-500">
                          {label.slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {label}
                      </p>
                      {t.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                          {t.description}
                        </p>
                      )}
                      <div className="mt-2">
                        {connected ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Connected
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              connecting === t.slug ||
                              used >= MAX_COMPOSIO_CONNECTIONS ||
                              !configured
                            }
                            onClick={() => void connect(t.slug)}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                          >
                            {connecting === t.slug
                              ? "Opening…"
                              : used >= MAX_COMPOSIO_CONNECTIONS
                                ? "Limit reached"
                                : "Connect"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
