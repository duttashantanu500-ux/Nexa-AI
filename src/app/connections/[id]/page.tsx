"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { loadOperatorState } from "@/lib/operatorStore";
import {
  getConnector,
  statusBadgeClass,
  statusLabel,
  type ConnectorUiStatus,
} from "@/lib/connectors/registry";
import { testComfyConnection } from "@/lib/connectors/localComfy";

const COMFY_KEY = "nexa_comfy_base_url";
const NOTION_PARENT_KEY = "nexa_notion_default_parent";

export default function ConnectorDetailPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="px-4 py-12 text-center text-sm text-zinc-500">Loading…</div>
        </AppShell>
      }
    >
      <ConnectorDetailInner />
    </Suspense>
  );
}

function ConnectorDetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const connector = getConnector(id);

  const [userId, setUserId] = useState("");
  const [comfyUrl, setComfyUrl] = useState("");
  const [comfyStatus, setComfyStatus] = useState<"unknown" | "ok" | "fail">("unknown");
  const [comfyMsg, setComfyMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [banner, setBanner] = useState("");

  // Notion
  const [notionStatus, setNotionStatus] = useState<ConnectorUiStatus | null>(null);
  const [notionMsg, setNotionMsg] = useState("");
  const [notionWorkspace, setNotionWorkspace] = useState<string | null>(null);
  const [notionConnectPath, setNotionConnectPath] = useState<string | null>(null);
  const [notionBusy, setNotionBusy] = useState(false);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionDefaultParent, setNotionDefaultParent] = useState("");

  // Slack
  const [slackStatus, setSlackStatus] = useState<ConnectorUiStatus | null>(null);
  const [slackMsg, setSlackMsg] = useState("");
  const [slackWorkspace, setSlackWorkspace] = useState<string | null>(null);
  const [slackConnectPath, setSlackConnectPath] = useState<string | null>(null);
  const [slackBusy, setSlackBusy] = useState(false);
  const [slackLoading, setSlackLoading] = useState(false);

  const refreshNotion = useCallback(async (uid: string) => {
    if (!uid) return;
    setNotionLoading(true);
    try {
      const res = await fetch(
        `/api/connections/notion/status?userId=${encodeURIComponent(uid)}`
      );
      const data = await res.json();
      setNotionStatus((data.status as ConnectorUiStatus) || "available");
      setNotionMsg(data.message || "");
      setNotionWorkspace(data.workspaceName || null);
      setNotionConnectPath(data.connectPath || null);
    } catch {
      setNotionStatus("error");
      setNotionMsg("Could not load status.");
    } finally {
      setNotionLoading(false);
    }
  }, []);

  const refreshSlack = useCallback(async (uid: string) => {
    if (!uid) return;
    setSlackLoading(true);
    try {
      const res = await fetch(
        `/api/connections/slack/status?userId=${encodeURIComponent(uid)}`
      );
      const data = await res.json();
      setSlackStatus((data.status as ConnectorUiStatus) || "available");
      setSlackMsg(data.message || "");
      setSlackWorkspace(data.workspaceName || null);
      setSlackConnectPath(data.connectPath || null);
    } catch {
      setSlackStatus("error");
      setSlackMsg("Could not load status.");
    } finally {
      setSlackLoading(false);
    }
  }, []);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setUserId(s.user.id);
    try {
      setComfyUrl(localStorage.getItem(COMFY_KEY) || "");
      setNotionDefaultParent(localStorage.getItem(NOTION_PARENT_KEY) || "");
    } catch {
      /* */
    }
    if (id === "notion") void refreshNotion(s.user.id);
    if (id === "slack") void refreshSlack(s.user.id);

    const err = search.get("error");
    const connected = search.get("connected");
    if (err) {
      if (id === "slack") {
        setBanner("Slack connection did not complete. You can try again when you're ready.");
      } else {
        setBanner("Something went wrong. Please try connecting again.");
      }
    }
    if (connected) {
      if (id === "slack") {
        setBanner("Saving your Slack connection…");
        void refreshSlack(s.user.id).then(() =>
          setBanner("Your Slack workspace is connected.")
        );
      } else if (id === "notion") {
        setBanner("Saving your Notion connection…");
        void refreshNotion(s.user.id).then(() =>
          setBanner("Your Notion account is connected.")
        );
      }
    }
  }, [router, id, search, refreshNotion, refreshSlack]);

  if (!connector) {
    return (
      <AppShell>
        <div className="px-4 py-16 text-center text-sm text-zinc-500">
          Not found.{" "}
          <Link href="/connections" className="text-indigo-600">
            Back
          </Link>
        </div>
      </AppShell>
    );
  }

  const resolveStatus = (): ConnectorUiStatus | "loading" => {
    if (connector.id === "notion") {
      if (notionLoading || notionStatus === null) return "loading";
      return notionStatus;
    }
    if (connector.id === "slack") {
      if (slackLoading || slackStatus === null) return "loading";
      return slackStatus;
    }
    if (connector.defaultStatus === "coming_soon") return "coming_soon";
    if (connector.id === "local_data" || connector.id === "vault") return "connected";
    if (connector.id === "local_comfyui") {
      return comfyStatus === "ok" || comfyUrl.trim() ? "connected" : "available";
    }
    if (!connector.executable) return "coming_soon";
    return connector.defaultStatus;
  };

  const status = resolveStatus();
  const badgeStatus: ConnectorUiStatus =
    status === "loading" ? "available" : status;

  const testNotion = async () => {
    if (!userId) return;
    setNotionBusy(true);
    setBanner("");
    try {
      const res = await fetch("/api/connections/notion/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || (data.ok ? "Success" : "Failed"));
      await refreshNotion(userId);
    } catch {
      setBanner("Something went wrong. Please try again.");
    }
    setNotionBusy(false);
  };

  const disconnectNotion = async () => {
    if (!userId) return;
    if (!confirm("Disconnect your Notion account from Nexa?")) return;
    setNotionBusy(true);
    try {
      const res = await fetch("/api/connections/notion/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || "Disconnected.");
      await refreshNotion(userId);
    } catch {
      setBanner("Could not disconnect.");
    }
    setNotionBusy(false);
  };

  const testSlack = async () => {
    if (!userId) return;
    setSlackBusy(true);
    setBanner("");
    try {
      const res = await fetch("/api/connections/slack/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || (data.ok ? "Success" : "Failed"));
      await refreshSlack(userId);
    } catch {
      setBanner("Something went wrong. Please try again.");
    }
    setSlackBusy(false);
  };

  const disconnectSlack = async () => {
    if (!userId) return;
    if (!confirm("Disconnect your Slack workspace from Nexa?")) return;
    setSlackBusy(true);
    try {
      const res = await fetch("/api/connections/slack/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || "Disconnected.");
      await refreshSlack(userId);
    } catch {
      setBanner("Could not disconnect.");
    }
    setSlackBusy(false);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <Link href="/connections" className="text-xs text-zinc-500 hover:text-indigo-600">
            ← Connections
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
              <ConnectorLogo id={connector.id} size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {connector.name}
                </h1>
                {status === "loading" ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                    Checking…
                  </span>
                ) : (
                  <span className={statusBadgeClass(badgeStatus)}>
                    {statusLabel(badgeStatus)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {connector.detailDescription || connector.description}
              </p>
              {connector.id === "notion" &&
                notionWorkspace &&
                status === "connected" && (
                  <p className="mt-1 text-xs text-zinc-400">{notionWorkspace}</p>
                )}
              {connector.id === "slack" &&
                slackWorkspace &&
                status === "connected" && (
                  <p className="mt-1 text-xs text-zinc-400">{slackWorkspace}</p>
                )}
            </div>
          </div>
        </div>

        {banner && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {banner}
          </div>
        )}

        {status === "coming_soon" && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Coming soon — not available to connect yet.
          </div>
        )}

        {connector.id === "notion" && status === "loading" && (
          <p className="text-sm text-zinc-500">Checking connection…</p>
        )}

        {connector.id === "slack" && status === "loading" && (
          <p className="text-sm text-zinc-500">Checking connection…</p>
        )}

        {connector.id === "notion" && status !== "coming_soon" && status !== "loading" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {status !== "connected" && notionConnectPath && (
                <a
                  href={notionConnectPath}
                  className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Connect your Notion
                </a>
              )}
              {status !== "connected" && !notionConnectPath && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Connect is not available right now. Please try again in a moment.
                </p>
              )}
              {status === "connected" && (
                <>
                  <button
                    type="button"
                    disabled={notionBusy}
                    onClick={() => void testNotion()}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    {notionBusy ? "Checking…" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    disabled={notionBusy}
                    onClick={() => void disconnectNotion()}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>

            {status === "connected" && (
              <section className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <h2 className="text-sm font-semibold">Default page (optional)</h2>
                <p className="text-xs text-zinc-500">
                  Paste a link to a page in your Notion. New pages go under it.
                </p>
                <input
                  value={notionDefaultParent}
                  onChange={(e) => setNotionDefaultParent(e.target.value)}
                  placeholder="https://www.notion.so/..."
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white"
                  onClick={() => {
                    try {
                      localStorage.setItem(NOTION_PARENT_KEY, notionDefaultParent.trim());
                      setBanner("Default page saved.");
                    } catch {
                      setBanner("Could not save.");
                    }
                  }}
                >
                  Save
                </button>
              </section>
            )}
            {status === "error" && <p className="text-sm text-red-600">{notionMsg}</p>}
          </div>
        )}

        {connector.id === "slack" && status !== "coming_soon" && status !== "loading" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {status !== "connected" && slackConnectPath && (
                <a
                  href={slackConnectPath}
                  className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Connect your Slack
                </a>
              )}
              {status !== "connected" && !slackConnectPath && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {slackMsg ||
                    "Connect is not available right now. Please try again in a moment."}
                </p>
              )}
              {status === "connected" && (
                <>
                  <button
                    type="button"
                    disabled={slackBusy}
                    onClick={() => void testSlack()}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    {slackBusy ? "Checking…" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    disabled={slackBusy}
                    onClick={() => void disconnectSlack()}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
            {status === "error" && <p className="text-sm text-red-600">{slackMsg}</p>}
            {status === "available" && slackMsg && (
              <p className="text-sm text-zinc-500">{slackMsg}</p>
            )}
          </div>
        )}

        {connector.id === "local_comfyui" && (
          <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Local image engine</h2>
            <input
              value={comfyUrl}
              onChange={(e) => setComfyUrl(e.target.value)}
              placeholder="http://127.0.0.1:8188"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              disabled={testing || !comfyUrl.trim()}
              onClick={async () => {
                setTesting(true);
                const r = await testComfyConnection(comfyUrl);
                setComfyStatus(r.ok ? "ok" : "fail");
                setComfyMsg(r.message);
                if (r.ok) localStorage.setItem(COMFY_KEY, comfyUrl.trim());
                setTesting(false);
              }}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              {testing ? "Testing…" : "Test"}
            </button>
            {comfyMsg && <p className="text-xs text-zinc-500">{comfyMsg}</p>}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">What it can do</h2>
          {connector.actions.filter((a) => a.implemented && a.available).length === 0 ? (
            <p className="text-sm text-zinc-500">No actions yet.</p>
          ) : (
            <ul className="space-y-2">
              {connector.actions
                .filter((a) => a.implemented && a.available)
                .map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <div className="font-medium">{a.name}</div>
                    <p className="text-xs text-zinc-500">{a.description}</p>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {connector.scopes && connector.scopes.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Permissions</h2>
            <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
              {connector.scopes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
