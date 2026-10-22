"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { McpConnectionPanel } from "@/components/McpConnectionPanel";
import { loadOperatorState } from "@/lib/operatorStore";
import { getStableUserId } from "@/lib/sessionUser";
import { getSupabase } from "@/lib/supabase";
import {
  CONNECTOR_REGISTRY,
  statusBadgeClass,
  statusLabel,
  type ConnectorDefinition,
  type ConnectorUiStatus,
} from "@/lib/connectors/registry";
import { assertCanConnect } from "@/lib/clientBilling";
import { UpgradeLimitModal } from "@/components/UpgradeLimitModal";
import { LIMIT_MESSAGES } from "@/lib/plans";

const COMFY_KEY = "nexa_comfy_base_url";

async function resolveAccessToken(): Promise<string | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

function DetailInner() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const id = String(params?.id || "");
  const [status, setStatus] = useState<ConnectorUiStatus>("available");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitMsg, setLimitMsg] = useState(LIMIT_MESSAGES.connections);
  const [comfyUrl, setComfyUrl] = useState("");
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [canDisconnect, setCanDisconnect] = useState(false);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);

  const def = useMemo(
    () => CONNECTOR_REGISTRY.find((c) => c.id === id) as ConnectorDefinition | undefined,
    [id]
  );

  const loadStatus = useCallback(async () => {
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
    if (!def) return;
    if (def.id === "local_comfyui") {
      try {
        const u = localStorage.getItem(COMFY_KEY)?.trim() || "";
        setComfyUrl(u);
        setStatus(u ? "connected" : "available");
        setStatusMessage(u ? "ComfyUI URL saved on this device." : "Add your ComfyUI base URL.");
        setCanDisconnect(Boolean(u));
        setWorkspaceName(null);
      } catch {
        setStatus("available");
      }
      return;
    }
    if (def.id === "local_data" || def.id === "vault") {
      setStatus("connected");
      setStatusMessage("Built-in — always available to your AI employees.");
      setCanDisconnect(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/connections/status?userId=${encodeURIComponent(uid)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      const row = (data?.statuses || {})[id] || {};
      const st = (row.status as ConnectorUiStatus) || "available";
      setStatus(st);
      setStatusMessage(String(row.message || ""));
      setWorkspaceName(row.workspaceName || null);
      setCanDisconnect(Boolean(row.canDisconnect));
      setConnectedAt(typeof row.connectedAt === "string" ? row.connectedAt : null);
    } catch {
      setStatus("available");
    }
  }, [def, id, router]);

  useEffect(() => {
    void loadStatus();
    const q = (search.get("s") || "").toLowerCase();
    if (q === "connected" || q === "available" || q === "error") {
      setStatus(q as ConnectorUiStatus);
    }
    if (search.get("connected")) {
      setMsg("Connected successfully.");
      setStatus("connected");
    }
    if (search.get("error")) {
      setMsg("Could not finish connecting. Try again or check the tool is still linked.");
    }
  }, [loadStatus, search]);

  if (!def) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-4 py-12 text-center">
          <p className="text-sm text-zinc-500">Unknown connection.</p>
          <Link href="/connections" className="mt-3 inline-block text-sm text-indigo-600">
            ← Back to Connections
          </Link>
        </div>
      </AppShell>
    );
  }

  const startOAuth = async () => {
    const s = loadOperatorState();
    const uid = (s.user?.id || getStableUserId() || "").trim();
    if (!uid) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setMsg("");
    const gate = await assertCanConnect(uid);
    if (!gate.ok) {
      setLimitMsg(gate.message);
      setLimitOpen(true);
      setBusy(false);
      return;
    }
    const oauthProviders = ["notion", "slack", "buffer", "hubspot", "github"] as const;
    if (!oauthProviders.includes(def.id as (typeof oauthProviders)[number])) {
      setMsg("This connection does not use OAuth here.");
      setBusy(false);
      return;
    }
    window.location.href = `/api/oauth/${def.id}/start?userId=${encodeURIComponent(uid)}`;
  };

  const disconnect = async () => {
    const s = loadOperatorState();
    const uid = (s.user?.id || getStableUserId() || "").trim();
    if (!uid) {
      router.push("/login");
      return;
    }
    if (def.id === "local_comfyui") {
      try {
        localStorage.removeItem(COMFY_KEY);
        setComfyUrl("");
        setStatus("available");
        setCanDisconnect(false);
        setMsg("ComfyUI URL cleared.");
        setStatusMessage("Add your ComfyUI base URL.");
      } catch {
        setMsg("Could not clear.");
      }
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const token = await resolveAccessToken();
      if (!token) {
        setMsg("Please sign in again to disconnect.");
        setBusy(false);
        return;
      }
      const endpoint = `/api/connections/${def.id}/disconnect`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: uid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setMsg(data.message || "Could not disconnect.");
        setBusy(false);
        return;
      }
      setStatus("available");
      setCanDisconnect(false);
      setWorkspaceName(null);
      setConnectedAt(null);
      setMsg(data.message || "Disconnected.");
      setStatusMessage(`Connect ${def.name} to use it with your AI employees.`);
      await loadStatus();
    } catch {
      setMsg("Could not disconnect. Try again.");
    }
    setBusy(false);
  };

  const testConnection = async () => {
    const s = loadOperatorState();
    const uid = (s.user?.id || getStableUserId() || "").trim();
    if (!uid) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(
        `/api/connections/${def.id}/test?userId=${encodeURIComponent(uid)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setMsg(data.message || "Connection looks healthy.");
        setStatus("connected");
      } else {
        setMsg(data.message || "Test failed. Try reconnecting.");
      }
    } catch {
      setMsg("Could not run test.");
    }
    setBusy(false);
  };

  const saveApiKey = async () => {
    const s = loadOperatorState();
    const uid = (s.user?.id || getStableUserId() || "").trim();
    if (!uid) {
      router.push("/login");
      return;
    }
    const key = apiKey.trim();
    if (!key) {
      setMsg("Enter an API key.");
      return;
    }
    setBusy(true);
    setMsg("");
    const gate = await assertCanConnect(uid);
    if (!gate.ok) {
      setLimitMsg(gate.message);
      setLimitOpen(true);
      setBusy(false);
      return;
    }
    try {
      const endpoint =
        def.id === "ideogram"
          ? "/api/connections/ideogram/connect"
          : def.id === "vapi"
            ? "/api/connections/vapi/connect"
            : "";
      if (!endpoint) {
        setMsg("API key save is not available for this tool.");
        setBusy(false);
        return;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, apiKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setMsg(data.message || "Could not save key.");
        setBusy(false);
        return;
      }
      setStatus("connected");
      setCanDisconnect(true);
      setMsg("Connected.");
      setApiKey("");
      await loadStatus();
    } catch {
      setMsg("Could not save. Try again.");
    }
    setBusy(false);
  };

  const saveComfy = () => {
    const u = comfyUrl.trim();
    try {
      if (u) localStorage.setItem(COMFY_KEY, u);
      else localStorage.removeItem(COMFY_KEY);
      setStatus(u ? "connected" : "available");
      setCanDisconnect(Boolean(u));
      setMsg(u ? "ComfyUI URL saved." : "ComfyUI URL cleared.");
    } catch {
      setMsg("Could not save locally.");
    }
  };

  const isOAuth = ["notion", "slack", "buffer", "hubspot", "github"].includes(def.id);
  const isApiKey = ["ideogram", "vapi"].includes(def.id);
  const isComfy = def.id === "local_comfyui";
  const isMcp = def.id === "mcp";
  const isConnected = status === "connected";

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <ConnectorLogo id={def.id} size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{def.name}</h1>
            <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
          </div>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">{def.description}</p>

        {statusMessage && (
          <p className="text-sm text-zinc-500">{statusMessage}</p>
        )}

        {isConnected && workspaceName && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-zinc-500">Workspace · </span>
            <span className="font-medium text-zinc-800 dark:text-zinc-100">{workspaceName}</span>
          </div>
        )}

        {isConnected && connectedAt && (
          <p className="text-xs text-zinc-400">
            Connected {new Date(connectedAt).toLocaleString()}
          </p>
        )}

        {msg && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {msg}
          </div>
        )}

        {isOAuth && (
          <div className="space-y-3">
            {!isConnected ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startOAuth()}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Redirecting…" : `Connect ${def.name}`}
                </button>
                <p className="text-xs text-zinc-500">
                  You will authorize Nexa in {def.name}, then return here.
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startOAuth()}
                  className="flex-1 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                >
                  {busy ? "…" : "Reconnect"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void testConnection()}
                  className="flex-1 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                >
                  Test
                </button>
                {canDisconnect && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void disconnect()}
                    className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isApiKey && (
          <div className="space-y-3">
            {!isConnected && (
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">API key</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              {!isConnected ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveApiKey()}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save and connect"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStatus("available");
                      setMsg("Paste a new key to update.");
                    }}
                    className="flex-1 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    Update key
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void testConnection()}
                    className="flex-1 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    Test
                  </button>
                  {canDisconnect && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void disconnect()}
                      className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    >
                      Disconnect
                    </button>
                  )}
                </>
              )}
            </div>
            {status === "available" && apiKey && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveApiKey()}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save key"}
              </button>
            )}
          </div>
        )}

        {isMcp && (
          <McpConnectionPanel
            userId={(loadOperatorState().user?.id || getStableUserId() || "").trim()}
            onStatus={(s) => setStatus(s === "loading" ? "available" : s)}
          />
        )}

        {isComfy && (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs text-zinc-500">ComfyUI base URL</span>
              <input
                value={comfyUrl}
                onChange={(e) => setComfyUrl(e.target.value)}
                placeholder="http://127.0.0.1:8188"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveComfy}
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white"
              >
                Save URL
              </button>
              {canDisconnect && (
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {!isOAuth && !isApiKey && !isComfy && !isMcp && (
          <p className="text-sm text-zinc-500">
            This connection is available to your AI employees without extra setup.
          </p>
        )}

        <Link href="/connections" className="inline-block text-sm text-indigo-600">
          ← Back to Connections
        </Link>
      </div>
      <UpgradeLimitModal
        open={limitOpen}
        message={limitMsg}
        onClose={() => setLimitOpen(false)}
      />
    </AppShell>
  );
}

export default function ConnectionDetailPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="px-4 py-12 text-center text-sm text-zinc-500">Loading…</div>
        </AppShell>
      }
    >
      <DetailInner />
    </Suspense>
  );
}
