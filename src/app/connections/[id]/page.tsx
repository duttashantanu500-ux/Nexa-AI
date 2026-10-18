"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { McpConnectionPanel } from "@/components/McpConnectionPanel";
import { UpgradeLimitModal } from "@/components/UpgradeLimitModal";
import { loadOperatorState } from "@/lib/operatorStore";
import { getStableUserId } from "@/lib/sessionUser";
import {
  getConnector,
  statusBadgeClass,
  statusLabel,
  type ConnectorUiStatus,
} from "@/lib/connectors/registry";
import { testComfyConnection } from "@/lib/connectors/localComfy";
import { authHeaders } from "@/lib/authHeaders";
import { assertCanConnect } from "@/lib/clientBilling";
import { LIMIT_MESSAGES } from "@/lib/plans";

const COMFY_KEY = "nexa_comfy_base_url";
const NOTION_PARENT_KEY = "nexa_notion_default_parent";
const STATUS_CACHE_KEY = "nexa_conn_status_v1";

type Provider =
  | "notion"
  | "slack"
  | "buffer"
  | "hubspot"
  | "ideogram"
  | "vapi";

const API_KEY_SETUP: Partial<Record<Provider, string>> = {
  ideogram: "/connections/ideogram/setup",
  vapi: "/connections/vapi/setup",
};

function isUiStatus(s: string | null | undefined): s is ConnectorUiStatus {
  return (
    s === "connected" ||
    s === "available" ||
    s === "error" ||
    s === "unavailable" ||
    s === "coming_soon"
  );
}

function readCachedStatus(providerId: string): ConnectorUiStatus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STATUS_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Partial<Record<string, ConnectorUiStatus>>;
    const s = map[providerId];
    return isUiStatus(s) ? s : null;
  } catch {
    return null;
  }
}

function writeCachedStatus(providerId: string, status: ConnectorUiStatus) {
  try {
    const raw = sessionStorage.getItem(STATUS_CACHE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, ConnectorUiStatus>;
    map[providerId] = status;
    sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* */
  }
}

function seedFromQueryAndCache(
  id: string,
  queryStatus: string | null
): ConnectorUiStatus {
  if (isUiStatus(queryStatus)) return queryStatus;
  const fromCache = readCachedStatus(id);
  if (fromCache) return fromCache;
  return "available";
}

function paramId(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return "";
}

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
  const params = useParams();
  const id = useMemo(() => paramId(params?.id as string | string[] | undefined), [params]);
  const router = useRouter();
  const search = useSearchParams();
  const connector = id ? getConnector(id) : undefined;

  const [status, setStatus] = useState<ConnectorUiStatus>("available");
  const [userId, setUserId] = useState("");
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [connectPath, setConnectPath] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitMsg, setLimitMsg] = useState(LIMIT_MESSAGES.connections);
  const [msg, setMsg] = useState("");
  const [comfyUrl, setComfyUrl] = useState("");
  const [comfyMsg, setComfyMsg] = useState("");
  const [notionDefaultParent, setNotionDefaultParent] = useState("");

  const providers: Provider[] = [
    "notion",
    "slack",
    "buffer",
    "hubspot",
    "ideogram",
    "vapi",
  ];
  const isProvider = providers.includes(id as Provider);

  const refreshStatus = useCallback(async (uid: string, provider: string) => {
    if (!uid || !provider) return;
    try {
      const batchRes = await fetch(
        `/api/connections/status?userId=${encodeURIComponent(uid)}`,
        { cache: "no-store" }
      );
      const batch = await batchRes.json().catch(() => ({}));
      const st = (batch?.statuses || {}) as Record<
        string,
        { status?: string; workspaceName?: string | null; message?: string; connectPath?: string }
      >;
      const row = st[provider];
      if (row?.status && isUiStatus(row.status)) {
        setStatus(row.status);
        writeCachedStatus(provider, row.status);
        if (row.workspaceName) setWorkspace(row.workspaceName);
        if (row.message) setMsg(row.message);
        const setupFallback = API_KEY_SETUP[provider as Provider];
        setConnectPath(row.connectPath || setupFallback || null);
        return;
      }
      const res = await fetch(
        `/api/connections/${provider}/status?userId=${encodeURIComponent(uid)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      const next = isUiStatus(data.status) ? data.status : "available";
      setStatus(next);
      writeCachedStatus(provider, next);
      setWorkspace(data.workspaceName || null);
      setConnectPath(data.connectPath || null);
      setMsg(data.message || "");
    } catch {
      /* keep seeded status */
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    setStatus(seedFromQueryAndCache(id, search.get("s")));
    const s = loadOperatorState();
    const uid = (s.user?.id || getStableUserId() || "").trim();
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
    const err = search.get("error");
    const connected = search.get("connected");
    if (connected && isProvider) {
      setStatus("connected");
      writeCachedStatus(id, "connected");
      setBanner(`${connector?.name || "Account"} is connected.`);
    } else if (err) {
      setBanner(
        err === "save_failed"
          ? "We couldn't save your connection. Please try connecting again."
          : "Something went wrong. Please try connecting again."
      );
    }
    if (isProvider) void refreshStatus(uid, id);
  }, [router, id, search, refreshStatus, isProvider, connector?.name]);

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
    if (isProvider) return status;
    if (connector.id === "mcp") return status;
    if (connector.defaultStatus === "coming_soon") return "coming_soon";
    if (connector.id === "local_data" || connector.id === "vault") return "connected";
    if (connector.id === "local_comfyui") {
      return comfyUrl.trim() ? "connected" : "available";
    }
    if (!connector.executable) return "coming_soon";
    return connector.defaultStatus === "loading" ? "available" : connector.defaultStatus;
  };

  const uiStatus = resolveStatus();

  const testConnection = async () => {
    if (!userId || !isProvider) return;
    setBusy(true);
    setBanner("");
    try {
      const res = await fetch(`/api/connections/${id}/test`, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      setBanner(data.message || (data.ok ? "Success" : "Could not verify connection."));
      await refreshStatus(userId, id);
    } catch {
      setBanner("Something went wrong. Please try again.");
    }
    setBusy(false);
  };

  const disconnect = async () => {
    if (!userId || !isProvider) return;
    if (!confirm(`Disconnect ${connector.name} from Nexa?`)) return;
    setBusy(true);
    setBanner("");
    try {
      const res = await fetch(`/api/connections/${id}/disconnect`, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      setBanner(data.message || "Disconnected.");
      setStatus("available");
      writeCachedStatus(id, "available");
      await refreshStatus(userId, id);
    } catch {
      setBanner("Could not disconnect.");
    }
    setBusy(false);
  };

  const connectHref = (() => {
    if (connectPath) return connectPath;
    if (!userId || !isProvider) return null;
    const setup = API_KEY_SETUP[id as Provider];
    if (setup) return setup;
    return `/api/oauth/${id}/start?userId=${encodeURIComponent(userId)}`;
  })();

  const saveComfy = async () => {
    try {
      localStorage.setItem(COMFY_KEY, comfyUrl.trim());
    } catch {
      /* */
    }
    setBusy(true);
    const r = await testComfyConnection(comfyUrl.trim());
    setComfyMsg(r.message || (r.ok ? "Connected" : "Could not reach ComfyUI"));
    setBusy(false);
  };

  const saveNotionParent = () => {
    try {
      localStorage.setItem(NOTION_PARENT_KEY, notionDefaultParent.trim());
      setBanner("Default Notion page saved on this device.");
    } catch {
      setBanner("Could not save on this device.");
    }
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
                <span className={statusBadgeClass(uiStatus)}>{statusLabel(uiStatus)}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {connector.detailDescription || connector.description}
              </p>
              {workspace && uiStatus === "connected" && (
                <p className="mt-1 text-xs text-zinc-400">{workspace}</p>
              )}
              {msg && isProvider && <p className="mt-1 text-xs text-zinc-400">{msg}</p>}
            </div>
          </div>
        </div>

        {banner && connector.id !== "mcp" && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {banner}
          </div>
        )}

        {uiStatus === "coming_soon" && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Coming soon — not available to connect yet.
          </div>
        )}

        {connector.id === "mcp" && (
          <McpConnectionPanel
            userId={userId}
            onStatus={(s) => {
              if (isUiStatus(s)) {
                setStatus(s);
                writeCachedStatus("mcp", s);
              }
            }}
          />
        )}

        {isProvider && uiStatus !== "coming_soon" && (
          <div className="flex flex-wrap gap-2">
            {uiStatus !== "connected" && connectHref && (
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => {
                  void (async () => {
                    if (!userId) return;
                    setBusy(true);
                    const gate = await assertCanConnect(userId);
                    setBusy(false);
                    if (!gate.ok) {
                      setLimitMsg(gate.message || LIMIT_MESSAGES.connections);
                      setLimitOpen(true);
                      return;
                    }
                    window.location.href = connectHref;
                  })();
                }}
              >
                {connector.id === "buffer" ? "Connect Buffer" : `Connect ${connector.name}`}
              </button>
            )}
            {uiStatus === "connected" && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void testConnection()}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 disabled:opacity-50"
                >
                  {busy ? "Testing…" : "Test connection"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void disconnect()}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </>
            )}
            {uiStatus === "connected" && connectHref && (
              <a
                href={connectHref}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Reconnect
              </a>
            )}
          </div>
        )}

        <UpgradeLimitModal
          open={limitOpen}
          message={limitMsg}
          onClose={() => setLimitOpen(false)}
        />

        {connector.id === "notion" && uiStatus === "connected" && (
          <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-sm font-medium">Default page for new notes</div>
            <p className="text-xs text-zinc-500">
              Paste a Notion page link once. Your AI employees will use it when creating pages.
            </p>
            <input
              value={notionDefaultParent}
              onChange={(e) => setNotionDefaultParent(e.target.value)}
              placeholder="https://www.notion.so/..."
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={saveNotionParent}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white"
            >
              Save on this device
            </button>
          </div>
        )}

        {connector.id === "local_comfyui" && (
          <div className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-sm font-medium">ComfyUI address</div>
            <input
              value={comfyUrl}
              onChange={(e) => setComfyUrl(e.target.value)}
              placeholder="http://127.0.0.1:8188"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveComfy()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
            >
              Save & test
            </button>
            {comfyMsg && <p className="text-xs text-zinc-500">{comfyMsg}</p>}
          </div>
        )}

        {(connector.id === "local_data" || connector.id === "vault") && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Always available — no extra setup needed.
          </p>
        )}

        {Array.isArray(connector.scopes) && connector.scopes.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              What this connection can do
            </h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {connector.scopes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}

        {Array.isArray(connector.actions) && connector.actions.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Actions</h2>
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {connector.actions.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {a.name}
                    </span>
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
