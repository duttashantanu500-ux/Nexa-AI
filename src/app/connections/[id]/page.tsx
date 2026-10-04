"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { McpConnectionPanel } from "@/components/McpConnectionPanel";
import { loadOperatorState } from "@/lib/operatorStore";
import { getStableUserId } from "@/lib/sessionUser";
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

  const [notionStatus, setNotionStatus] = useState<ConnectorUiStatus>("available");
  const [notionMsg, setNotionMsg] = useState("");
  const [notionWorkspace, setNotionWorkspace] = useState<string | null>(null);
  const [notionConnectPath, setNotionConnectPath] = useState<string | null>(null);
  const [notionBusy, setNotionBusy] = useState(false);
  const [notionDefaultParent, setNotionDefaultParent] = useState("");

  const [slackStatus, setSlackStatus] = useState<ConnectorUiStatus>("available");
  const [slackMsg, setSlackMsg] = useState("");
  const [slackWorkspace, setSlackWorkspace] = useState<string | null>(null);
  const [slackConnectPath, setSlackConnectPath] = useState<string | null>(null);
  const [slackBusy, setSlackBusy] = useState(false);

  const [bufferStatus, setBufferStatus] = useState<ConnectorUiStatus>("available");
  const [bufferMsg, setBufferMsg] = useState("");
  const [bufferWorkspace, setBufferWorkspace] = useState<string | null>(null);
  const [bufferConnectPath, setBufferConnectPath] = useState<string | null>(null);
  const [bufferBusy, setBufferBusy] = useState(false);

  const [hubspotStatus, setHubspotStatus] = useState<ConnectorUiStatus>("available");
  const [hubspotMsg, setHubspotMsg] = useState("");
  const [hubspotWorkspace, setHubspotWorkspace] = useState<string | null>(null);
  const [hubspotConnectPath, setHubspotConnectPath] = useState<string | null>(null);
  const [hubspotBusy, setHubspotBusy] = useState(false);

  const [ideogramStatus, setIdeogramStatus] = useState<ConnectorUiStatus>("available");
  const [ideogramMsg, setIdeogramMsg] = useState("");
  const [ideogramBusy, setIdeogramBusy] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<ConnectorUiStatus>("available");

  const refreshNotion = useCallback(async (uid: string) => {
    if (!uid) return;
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
      setNotionStatus("available");
    }
  }, []);

  const refreshSlack = useCallback(async (uid: string) => {
    if (!uid) return;
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
      setSlackStatus("available");
    }
  }, []);

  const refreshBuffer = useCallback(async (uid: string) => {
    if (!uid) return;
    try {
      const res = await fetch(
        `/api/connections/buffer/status?userId=${encodeURIComponent(uid)}`
      );
      const data = await res.json();
      setBufferStatus((data.status as ConnectorUiStatus) || "available");
      setBufferMsg(data.message || "");
      setBufferWorkspace(data.workspaceName || null);
      setBufferConnectPath(data.connectPath || null);
    } catch {
      setBufferStatus("available");
    }
  }, []);

  const refreshHubspot = useCallback(async (uid: string) => {
    if (!uid) return;
    try {
      const res = await fetch(
        `/api/connections/hubspot/status?userId=${encodeURIComponent(uid)}`
      );
      const data = await res.json();
      setHubspotStatus((data.status as ConnectorUiStatus) || "available");
      setHubspotMsg(data.message || "");
      setHubspotWorkspace(data.workspaceName || null);
      setHubspotConnectPath(data.connectPath || null);
    } catch {
      setHubspotStatus("available");
    }
  }, []);

  const refreshIdeogram = useCallback(async (uid: string) => {
    if (!uid) return;
    try {
      const res = await fetch(
        `/api/connections/ideogram/status?userId=${encodeURIComponent(uid)}`
      );
      const data = await res.json();
      setIdeogramStatus((data.status as ConnectorUiStatus) || "available");
      setIdeogramMsg(data.message || "");
    } catch {
      setIdeogramStatus("available");
    }
  }, []);

  useEffect(() => {
    const s = loadOperatorState();
    const uid = getStableUserId() || s.user?.id || "";
    if (!uid) {
      router.replace("/signup");
      return;
    }
    if (s.user && !s.user.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }

    setUserId(uid);
    try {
      setComfyUrl(localStorage.getItem(COMFY_KEY) || "");
      setNotionDefaultParent(localStorage.getItem(NOTION_PARENT_KEY) || "");
    } catch {
      /* */
    }
    if (id === "notion") void refreshNotion(uid);
    if (id === "slack") void refreshSlack(uid);
    if (id === "buffer") void refreshBuffer(uid);
    if (id === "hubspot") void refreshHubspot(uid);
    if (id === "ideogram") void refreshIdeogram(uid);

    const err = search.get("error");
    const connected = search.get("connected");
    if (err) {
      if (err === "save_failed") {
        setBanner("We couldn't save your connection. Please try connecting again in a moment.");
      } else {
        setBanner("Something went wrong. Please try connecting again.");
      }
    }
    if (connected) {
      if (id === "slack") {
        void refreshSlack(uid).then(() => setBanner("Your Slack workspace is connected."));
      } else if (id === "notion") {
        void refreshNotion(uid).then(() => setBanner("Your Notion account is connected."));
      } else if (id === "buffer") {
        void refreshBuffer(uid).then(() => setBanner("Your Buffer account is connected."));
      } else if (id === "hubspot") {
        void refreshHubspot(uid).then(() => setBanner("Your HubSpot account is connected."));
      }
    }
  }, [router, id, search, refreshNotion, refreshSlack, refreshBuffer, refreshHubspot, refreshIdeogram]);

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

  const resolveStatus = (): ConnectorUiStatus => {
    if (connector.id === "notion") return notionStatus || "available";
    if (connector.id === "slack") return slackStatus || "available";
    if (connector.id === "buffer") return bufferStatus || "available";
    if (connector.id === "hubspot") return hubspotStatus || "available";
    if (connector.id === "ideogram") return ideogramStatus || "available";
    if (connector.id === "mcp") return mcpStatus || "available";
    if (connector.defaultStatus === "coming_soon") return "coming_soon";
    if (connector.id === "local_data" || connector.id === "vault") return "connected";
    if (connector.id === "local_comfyui") {
      return comfyStatus === "ok" || comfyUrl.trim() ? "connected" : "available";
    }
    if (!connector.executable) return "coming_soon";
    return connector.defaultStatus;
  };

  const status = resolveStatus();

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

  const testBuffer = async () => {
    if (!userId) return;
    setBufferBusy(true);
    setBanner("");
    try {
      const res = await fetch("/api/connections/buffer/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || (data.ok ? "Success" : "Failed"));
      await refreshBuffer(userId);
    } catch {
      setBanner("Something went wrong. Please try again.");
    }
    setBufferBusy(false);
  };

  const disconnectBuffer = async () => {
    if (!userId) return;
    if (!confirm("Disconnect your Buffer account from Nexa?")) return;
    setBufferBusy(true);
    try {
      const res = await fetch("/api/connections/buffer/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || "Disconnected.");
      await refreshBuffer(userId);
    } catch {
      setBanner("Could not disconnect.");
    }
    setBufferBusy(false);
  };

  const testHubspot = async () => {
    if (!userId) return;
    setHubspotBusy(true);
    setBanner("");
    try {
      const res = await fetch("/api/connections/hubspot/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || (data.ok ? "Success" : "Failed"));
      await refreshHubspot(userId);
    } catch {
      setBanner("Something went wrong. Please try again.");
    }
    setHubspotBusy(false);
  };

  const disconnectHubspot = async () => {
    if (!userId) return;
    if (!confirm("Disconnect your HubSpot account from Nexa?")) return;
    setHubspotBusy(true);
    try {
      const res = await fetch("/api/connections/hubspot/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || "Disconnected.");
      await refreshHubspot(userId);
    } catch {
      setBanner("Could not disconnect.");
    }
    setHubspotBusy(false);
  };

  const testIdeogram = async () => {
    if (!userId) return;
    setIdeogramBusy(true);
    setBanner("");
    try {
      const res = await fetch("/api/connections/ideogram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || (data.ok ? "Success" : "Failed"));
      await refreshIdeogram(userId);
    } catch {
      setBanner("Something went wrong. Please try again.");
    }
    setIdeogramBusy(false);
  };

  const disconnectIdeogram = async () => {
    if (!userId) return;
    if (!confirm("Disconnect your Ideogram account from Nexa?")) return;
    setIdeogramBusy(true);
    try {
      const res = await fetch("/api/connections/ideogram/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || "Disconnected.");
      await refreshIdeogram(userId);
    } catch {
      setBanner("Could not disconnect.");
    }
    setIdeogramBusy(false);
  };

  const notionHref =
    notionConnectPath ||
    (userId ? `/api/oauth/notion/start?userId=${encodeURIComponent(userId)}` : null);
  const slackHref =
    slackConnectPath ||
    (userId ? `/api/oauth/slack/start?userId=${encodeURIComponent(userId)}` : null);
  const bufferHref =
    bufferConnectPath ||
    (userId ? `/api/oauth/buffer/start?userId=${encodeURIComponent(userId)}` : null);
  const hubspotHref =
    hubspotConnectPath ||
    (userId ? `/api/oauth/hubspot/start?userId=${encodeURIComponent(userId)}` : null);

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
                <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {connector.detailDescription || connector.description}
              </p>
              {connector.id === "notion" && notionWorkspace && status === "connected" && (
                <p className="mt-1 text-xs text-zinc-400">{notionWorkspace}</p>
              )}
              {connector.id === "slack" && slackWorkspace && status === "connected" && (
                <p className="mt-1 text-xs text-zinc-400">{slackWorkspace}</p>
              )}
              {connector.id === "buffer" && bufferWorkspace && status === "connected" && (
                <p className="mt-1 text-xs text-zinc-400">{bufferWorkspace}</p>
              )}
              {connector.id === "hubspot" && hubspotWorkspace && status === "connected" && (
                <p className="mt-1 text-xs text-zinc-400">{hubspotWorkspace}</p>
              )}
            </div>
          </div>
        </div>

        {banner && connector.id !== "mcp" && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {banner}
          </div>
        )}

        {status === "coming_soon" && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Coming soon — not available to connect yet.
          </div>
        )}

        {connector.id === "mcp" && (
          <McpConnectionPanel
            userId={userId}
            onStatus={(s) => setMcpStatus(s as ConnectorUiStatus)}
          />
        )}

        {connector.id === "notion" && status !== "coming_soon" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {status !== "connected" && notionHref && (
                <a
                  href={notionHref}
                  className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Connect your Notion
                </a>
              )}
              {status === "connected" && (
                <>
                  <button
                    type="button"
                    disabled={notionBusy}
                    onClick={() => void testNotion()}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    {notionBusy ? "Working…" : "Test connection"}
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
            {status === "error" && notionMsg && (
              <p className="text-sm text-red-600">{notionMsg}</p>
            )}
          </div>
        )}

        {connector.id === "slack" && status !== "coming_soon" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {status !== "connected" && slackHref && (
                <a
                  href={slackHref}
                  className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Connect your Slack
                </a>
              )}
              {status === "connected" && (
                <>
                  <button
                    type="button"
                    disabled={slackBusy}
                    onClick={() => void testSlack()}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    {slackBusy ? "Working…" : "Test connection"}
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
            {status === "error" && slackMsg && (
              <p className="text-sm text-red-600">{slackMsg}</p>
            )}
          </div>
        )}

        {connector.id === "buffer" && status !== "coming_soon" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {status !== "connected" && bufferHref && (
                <a
                  href={bufferHref}
                  className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Connect your Buffer
                </a>
              )}
              {status === "connected" && (
                <>
                  <button
                    type="button"
                    disabled={bufferBusy}
                    onClick={() => void testBuffer()}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    {bufferBusy ? "Working…" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    disabled={bufferBusy}
                    onClick={() => void disconnectBuffer()}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
            {status === "error" && bufferMsg && (
              <p className="text-sm text-red-600">{bufferMsg}</p>
            )}
          </div>
        )}

        {connector.id === "hubspot" && status !== "coming_soon" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {status !== "connected" && hubspotHref && (
                <a
                  href={hubspotHref}
                  className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Connect your HubSpot
                </a>
              )}
              {status === "connected" && (
                <>
                  <button
                    type="button"
                    disabled={hubspotBusy}
                    onClick={() => void testHubspot()}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    {hubspotBusy ? "Working…" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    disabled={hubspotBusy}
                    onClick={() => void disconnectHubspot()}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
            {status === "error" && hubspotMsg && (
              <p className="text-sm text-red-600">{hubspotMsg}</p>
            )}
            {status === "available" && hubspotMsg && (
              <p className="text-sm text-zinc-500">{hubspotMsg}</p>
            )}
          </div>
        )}

        {connector.id === "ideogram" && status !== "coming_soon" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {status !== "connected" && (
                <Link
                  href="/connections/ideogram"
                  className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Set up Ideogram
                </Link>
              )}
              {status === "connected" && (
                <>
                  <button
                    type="button"
                    disabled={ideogramBusy}
                    onClick={() => void testIdeogram()}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    {ideogramBusy ? "Working…" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    disabled={ideogramBusy}
                    onClick={() => void disconnectIdeogram()}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
            {status === "error" && ideogramMsg && (
              <p className="text-sm text-red-600">{ideogramMsg}</p>
            )}
          </div>
        )}

        {connector.actions && connector.actions.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Actions</h2>
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {connector.actions.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{a.name}</span>
                    {a.requiresApproval && (
                      <span className="text-[10px] text-amber-600">Needs approval</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">{a.description}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
