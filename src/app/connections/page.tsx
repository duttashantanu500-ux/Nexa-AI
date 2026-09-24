"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState, addMcpConnection } from "@/lib/operatorStore";

interface ProviderStatus {
  provider: string;
  name: string;
  configured: boolean;
  oauthSupported: boolean;
}

function ConnectionsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [msg, setMsg] = useState("");
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpTools, setMcpTools] = useState<any[] | null>(null);
  const [mcpError, setMcpError] = useState("");
  const [mcpLoading, setMcpLoading] = useState(false);
  const [showMcp, setShowMcp] = useState(false);
  const [connected, setConnected] = useState<string[]>([]);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }

    const oauth = search.get("oauth");
    const provider = search.get("provider");
    if (oauth === "success" && provider) {
      setMsg(`${provider} connected successfully.`);
      try {
        const prev = JSON.parse(localStorage.getItem("nexa_oauth_connected") || "[]");
        const next = [...new Set([...(Array.isArray(prev) ? prev : []), provider])];
        localStorage.setItem("nexa_oauth_connected", JSON.stringify(next));
        setConnected(next);
      } catch {
        /* */
      }
    } else if (oauth === "error") {
      setMsg("Connection failed. Please try again later.");
    }

    try {
      const prev = JSON.parse(localStorage.getItem("nexa_oauth_connected") || "[]");
      if (Array.isArray(prev)) setConnected(prev);
    } catch {
      /* */
    }

    fetch("/api/connections/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.providers) setProviders(d.providers);
      })
      .catch(() => {});
  }, [router, search]);

  const connectGoogle = (provider: string) => {
    window.location.href = `/api/oauth/google/start?provider=${provider}`;
  };

  const discoverMcp = async () => {
    if (!mcpUrl.trim()) return;
    setMcpLoading(true);
    setMcpError("");
    setMcpTools(null);
    try {
      const res = await fetch("/api/mcp/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: mcpUrl.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMcpError(data.error || "Could not reach this server.");
        return;
      }
      setMcpTools(data.tools || []);
      addMcpConnection(mcpName || "Custom MCP", mcpUrl.trim());
    } catch {
      setMcpError("Could not reach this server.");
    } finally {
      setMcpLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
          <p className="text-sm text-muted mt-1">
            Connect tools Nexa can use. Status reflects real authorization only.
          </p>
        </div>

        {msg && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">{msg}</div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <div className="font-medium">Always available</div>
          <div className="text-muted mt-1">Web search · Page reader</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((p) => {
            const isOn = connected.includes(p.provider);
            return (
              <div
                key={p.provider}
                className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{p.name}</div>
                  <span
                    className={`text-[11px] rounded-full px-2 py-0.5 ${
                      isOn
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {isOn ? "Connected" : "Not connected"}
                  </span>
                </div>
                {!p.configured && (
                  <p className="text-xs text-muted">
                    This integration is not available yet for your workspace.
                  </p>
                )}
                {p.oauthSupported && p.configured && !isOn && (
                  <button
                    onClick={() => connectGoogle(p.provider)}
                    className="mt-1 self-start rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Connect
                  </button>
                )}
                {p.oauthSupported && !p.configured && (
                  <p className="text-xs text-muted">Setup required by administrator.</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
          {!showMcp ? (
            <button
              onClick={() => setShowMcp(true)}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              + Add custom MCP server
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-medium">Custom MCP server</div>
              <input
                value={mcpName}
                onChange={(e) => setMcpName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              />
              <input
                value={mcpUrl}
                onChange={(e) => setMcpUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              />
              {mcpError && <p className="text-xs text-red-600">{mcpError}</p>}
              {mcpTools && (
                <div className="text-xs space-y-1">
                  <div className="font-medium">Discovered {mcpTools.length} tool(s)</div>
                  {mcpTools.map((t) => (
                    <div key={t.name} className="text-muted">
                      {t.name}
                      {t.description ? ` — ${t.description}` : ""}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={discoverMcp}
                  disabled={!mcpUrl.trim() || mcpLoading}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                >
                  {mcpLoading ? "Connecting…" : "Connect & discover"}
                </button>
                <button
                  onClick={() => setShowMcp(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <ConnectionsInner />
    </Suspense>
  );
}
