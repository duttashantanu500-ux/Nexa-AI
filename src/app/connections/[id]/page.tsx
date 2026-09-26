"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
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
  const [notionStatus, setNotionStatus] = useState<ConnectorUiStatus | null>(null);
  const [notionMsg, setNotionMsg] = useState("");
  const [notionWorkspace, setNotionWorkspace] = useState<string | null>(null);
  const [notionConnectPath, setNotionConnectPath] = useState<string | null>(null);
  const [notionBusy, setNotionBusy] = useState(false);
  const [notionDefaultParent, setNotionDefaultParent] = useState("");

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
      setNotionStatus("error");
      setNotionMsg("Could not load status.");
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
    const err = search.get("error");
    const connected = search.get("connected");
    if (err) setBanner(`Something went wrong: ${err.replace(/_/g, " ")}`);
    if (connected) {
      setBanner("Saving your Notion connection…");
      void refreshNotion(s.user.id).then(() =>
        setBanner("Your Notion account is connected.")
      );
    }
  }, [router, id, search, refreshNotion]);

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
    if (connector.id === "notion" && notionStatus) return notionStatus;
    if (connector.defaultStatus === "coming_soon") return "coming_soon";
    if (connector.id === "local_data") return "connected";
    if (connector.id === "local_comfyui") {
      return comfyStatus === "ok" || comfyUrl.trim() ? "connected" : "available";
    }
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
      setBanner("Test failed");
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

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <Link href="/connections" className="text-xs text-zinc-500 hover:text-indigo-600">
            ← Connections
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {connector.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {connector.name}
                </h1>
                <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {connector.id === "notion"
                  ? "Connect your Notion. Agents use only your account — not Nexa's."
                  : connector.detailDescription || connector.description}
              </p>
              {connector.id === "notion" && notionWorkspace && status === "connected" && (
                <p className="mt-1 text-xs text-zinc-400">{notionWorkspace}</p>
              )}
            </div>
          </div>
        </div>

        {banner && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {banner}
          </div>
        )}

        {connector.id === "notion" && (
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
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {notionMsg ||
                    "Admin must set up Notion sign-in (public integration) before users can connect."}
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
                    {notionBusy ? "Checking…" : "Test"}
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
                <h2 className="text-sm font-semibold">Default page (optional, set once)</h2>
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
          <ul className="space-y-2">
            {connector.actions.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <div className="font-medium">{a.name}</div>
                <p className="text-xs text-zinc-500">{a.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
