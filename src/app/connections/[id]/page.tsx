"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

  /** Only implemented+available actions — single source of truth for UI and employees */
  const capabilities = useMemo(() => {
    if (!def?.actions?.length) return [];
    return def.actions.filter((a) => a.implemented && a.available);
  }, [def]);

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
    // Read OAuth return flags from the URL without useSearchParams (avoids Suspense hang).
    try {
      const sp = new URLSearchParams(window.location.search);
      const q = (sp.get("s") || "").toLowerCase();
      if (q === "connected" || q === "available" || q === "error") {
        setStatus(q as ConnectorUiStatus);
      }
      if (sp.get("connected")) {
        setMsg("Connected successfully.");
        setStatus("connected");
      }
      if (sp.get("error")) {
        setMsg("Could not finish connecting. Try again or check the tool is still linked.");
      }
    } catch {
      /* ignore */
    }
  }, [loadStatus]);

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
    try {
      const res = await fetch(`/api/oauth/${def.id}/start?userId=${encodeURIComponent(uid)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMsg(data.message || "Could not start connection.");
    } catch {
      setMsg("Could not start connection.");
    }
    setBusy(false);
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
      const token = await resolveAccessToken();
      if (!token) {
        setMsg("Please sign in again to run a test.");
        setBusy(false);
        return;
      }
      const res = await fetch(`/api/connections/${def.id}/test`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: uid }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setMsg(data.message || "Connection looks healthy.");
        setStatus("connected");
        await loadStatus();
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
    const u = comfyUrl.trim().replace(/\/$/, "");
    try {
      if (u) localStorage.setItem(COMFY_KEY, u);
      else localStorage.removeItem(COMFY_KEY);
      setStatus(u ? "connected" : "available");
      setCanDisconnect(Boolean(u));
      setMsg(u ? "ComfyUI URL saved." : "Cleared.");
      setStatusMessage(u ? "ComfyUI URL saved on this device." : "Add your ComfyUI base URL.");
    } catch {
      setMsg("Could not save on this device.");
    }
  };

  const isConnected = status === "connected";

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6 flex items-start gap-3">
          <ConnectorLogo id={def.id} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{def.name}</h1>
              <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">{def.description}</p>
          </div>
        </div>

        {msg && <p className="mb-3 text-sm text-indigo-600 dark:text-indigo-400">{msg}</p>}
        {statusMessage && <p className="text-sm text-zinc-500">{statusMessage}</p>}

        {isConnected && workspaceName && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Workspace · {workspaceName}
          </p>
        )}
        {isConnected && connectedAt && (
          <p className="text-xs text-zinc-400">Connected {new Date(connectedAt).toLocaleString()}</p>
        )}

        {def.id === "mcp" && <McpConnectionPanel />}

        {capabilities.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Capabilities</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              What your AI employees can do with this connection when it is connected.
            </p>
            <ul className="mt-3 space-y-2">
              {capabilities.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {a.name}
                    <span className="text-[10px] font-normal uppercase tracking-wide text-zinc-400">
                      {a.requiresApproval ? "Needs approval" : "Read"}
                    </span>
                  </div>
                  {a.description && (
                    <p className="mt-0.5 text-xs text-zinc-500">{a.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {def.id === "local_comfyui" && (
          <div className="mt-6 space-y-2">
            <label className="block text-xs font-medium text-zinc-500">ComfyUI base URL</label>
            <input
              value={comfyUrl}
              onChange={(e) => setComfyUrl(e.target.value)}
              placeholder="http://127.0.0.1:8188"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              disabled={busy}
              onClick={saveComfy}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {status === "available" && def.connectionMethod === "oauth" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startOAuth()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Connect {def.name}
            </button>
          )}
          {status === "available" && (def.id === "ideogram" || def.id === "vapi") && (
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API key"
                className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveApiKey()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Save and connect
              </button>
            </div>
          )}
          {isConnected && def.connectionMethod === "oauth" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void startOAuth()}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Reconnect
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void testConnection()}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Test
              </button>
              {canDisconnect && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void disconnect()}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 dark:border-red-900"
                >
                  Disconnect
                </button>
              )}
            </>
          )}
          {isConnected && (def.id === "ideogram" || def.id === "vapi") && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void testConnection()}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Test
              </button>
              {canDisconnect && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void disconnect()}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 dark:border-red-900"
                >
                  Disconnect
                </button>
              )}
            </>
          )}
        </div>

        {status === "available" && def.connectionMethod === "oauth" && (
          <p className="mt-3 text-xs text-zinc-500">
            You will authorize Nexa in {def.name}, then return here.
          </p>
        )}

        <Link href="/connections" className="mt-8 inline-block text-sm text-zinc-500 hover:text-indigo-600">
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
  return <DetailInner />;
}
