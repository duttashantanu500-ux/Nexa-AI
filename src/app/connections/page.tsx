"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState, addMcpConnection } from "@/lib/operatorStore";

interface ProviderStatus {
  provider: string;
  name: string;
  configured: boolean;
  missingEnv: string[];
  setupHint: string;
  oauthSupported: boolean;
}

function ConnectionsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [oauthMsg, setOauthMsg] = useState("");
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpTools, setMcpTools] = useState<any[] | null>(null);
  const [mcpError, setMcpError] = useState("");
  const [mcpLoading, setMcpLoading] = useState(false);
  const [showMcp, setShowMcp] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }

    const oauth = search.get("oauth");
    const provider = search.get("provider");
    const message = search.get("message");
    if (oauth === "success" && provider) {
      setOauthMsg(`${provider} authorized successfully (session token stored httpOnly).`);
      setConnectedProviders((p) => [...new Set([...p, provider])]);
      // Persist non-secret flag only
      try {
        const key = "nexa_oauth_connected";
        const prev = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(key, JSON.stringify([...new Set([...prev, provider])]));
      } catch {
        /* */
      }
    } else if (oauth === "error") {
      setOauthMsg(`OAuth failed: ${message || "unknown"}`);
    }

    try {
      const prev = JSON.parse(localStorage.getItem("nexa_oauth_connected") || "[]");
      if (Array.isArray(prev)) setConnectedProviders(prev);
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

  const connectGoogle = async (provider: string) => {
    // Navigate to OAuth start — server redirects or returns config required
    const res = await fetch(`/api/oauth/google/start?provider=${provider}`, {
      redirect: "manual",
    });
    // If JSON config required
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      setOauthMsg(
        data.message +
          (data.missingEnv?.length
            ? ` Missing: ${data.missingEnv.join(", ")}`
            : "")
      );
      return;
    }
    // Follow redirect
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
        setMcpError(data.error || "Connection failed");
        return;
      }
      setMcpTools(data.tools || []);
      addMcpConnection(mcpName || "Custom MCP", mcpUrl.trim());
    } catch (e: any) {
      setMcpError(e?.message || "Discover failed");
    } finally {
      setMcpLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
          <p className="text-sm text-muted mt-1">
            Connected only after real OAuth or successful MCP discovery. Nothing is faked.
          </p>
        </div>

        {oauthMsg && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">{oauthMsg}</div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <div className="font-medium">Available without OAuth</div>
          <div className="text-muted mt-1">web_search · web_page_reader · structured_data</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((p) => {
            const isConnected = connectedProviders.includes(p.provider);
            return (
              <div
                key={p.provider}
                className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{p.name}</div>
                  <span
                    className={`text-[11px] rounded-full px-2 py-0.5 ${
                      isConnected
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {isConnected ? "Connected" : "Not connected"}
                  </span>
                </div>
                {!p.configured && (
                  <p className="text-xs text-muted">
                    Configuration required: {p.missingEnv.join(", ") || "env vars"}
                  </p>
                )}
                <p className="text-xs text-muted">{p.setupHint}</p>
                {p.oauthSupported && (
                  <button
                    onClick={() => connectGoogle(p.provider)}
                    className="mt-1 self-start rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-sidebar"
                  >
                    {p.configured ? "Connect with Google" : "Show setup / try connect"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
          {!showMcp ? (
            <button
              onClick={() => setShowMcp(true)}
              className="text-sm font-medium hover:underline"
            >
              + Add Custom MCP
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-medium">MCP server</div>
              <input
                value={mcpName}
                onChange={(e) => setMcpName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              />
              <input
                value={mcpUrl}
                onChange={(e) => setMcpUrl(e.target.value)}
                placeholder="https://your-mcp-server.example/mcp"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              />
              <p className="text-xs text-muted">
                Discover calls the real endpoint via JSON-RPC tools/list. HTTPS required.
              </p>
              {mcpError && <p className="text-xs text-red-600">{mcpError}</p>}
              {mcpTools && (
                <div className="text-xs space-y-1">
                  <div className="font-medium">
                    Discovered {mcpTools.length} tool(s)
                  </div>
                  {mcpTools.length === 0 ? (
                    <p className="text-muted">Server responded but listed no tools.</p>
                  ) : (
                    mcpTools.map((t) => (
                      <div key={t.name} className="text-muted">
                        {t.name}
                        {t.description ? ` — ${t.description}` : ""}
                      </div>
                    ))
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={discoverMcp}
                  disabled={!mcpUrl.trim() || mcpLoading}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {mcpLoading ? "Connecting…" : "Connect & discover tools"}
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
