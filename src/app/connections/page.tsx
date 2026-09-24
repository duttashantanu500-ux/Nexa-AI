"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState, addMcpConnection } from "@/lib/operatorStore";
import { Connection, DEFAULT_CONNECTIONS } from "@/types";

export default function ConnectionsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>(DEFAULT_CONNECTIONS);
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [showMcp, setShowMcp] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    // Always start from catalog; never invent "connected" OAuth states
    const stored = s.connections?.length ? s.connections : DEFAULT_CONNECTIONS;
    setConnections(
      stored.map((c) =>
        c.provider === "mcp"
          ? c
          : { ...c, status: "not_connected" as const }
      )
    );
  }, [router]);

  const addMcp = () => {
    if (!mcpUrl.trim()) return;
    const next = addMcpConnection(mcpName || "Custom MCP", mcpUrl);
    setConnections(next);
    setMcpName("");
    setMcpUrl("");
    setShowMcp(false);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
          <p className="text-sm text-muted mt-1">
            Only real connections show as connected. OAuth providers are not live yet.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <div className="font-medium">Available now (no connection needed)</div>
          <div className="text-muted mt-1">
            web_search · web_page_reader · structured_data
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {connections
            .filter((c) => c.provider !== "mcp")
            .map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted">{c.description}</div>
                  </div>
                  <span className="text-[11px] rounded-full px-2 py-0.5 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    Not connected
                  </span>
                </div>
                <p className="text-xs text-muted">Setup required — OAuth not implemented yet.</p>
              </div>
            ))}
        </div>

        {connections.some((c) => c.provider === "mcp") && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Custom MCP endpoints</h2>
            {connections
              .filter((c) => c.provider === "mcp")
              .map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-border bg-card p-4 text-sm"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted break-all mt-1">{c.mcpUrl}</div>
                  <p className="text-xs text-muted mt-2">
                    Metadata saved. Tool discovery and execution are not live yet.
                  </p>
                </div>
              ))}
          </div>
        )}

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
              <div className="text-sm font-medium">Custom MCP endpoint</div>
              <input
                value={mcpName}
                onChange={(e) => setMcpName(e.target.value)}
                placeholder="Name (e.g. My CRM MCP)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              />
              <input
                value={mcpUrl}
                onChange={(e) => setMcpUrl(e.target.value)}
                placeholder="https://your-mcp-server.example/sse"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              />
              <p className="text-xs text-muted">
                Saves endpoint metadata only. Do not paste secrets here.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={addMcp}
                  disabled={!mcpUrl.trim()}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Save MCP
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
