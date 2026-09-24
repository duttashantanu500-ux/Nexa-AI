"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  loadOperatorState,
  toggleConnection,
  pushActivity,
  addMcpConnection,
} from "@/lib/operatorStore";
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
    setConnections(s.connections?.length ? s.connections : DEFAULT_CONNECTIONS);
  }, [router]);

  const onToggle = (id: string) => {
    const next = toggleConnection(id);
    setConnections(next);
    const c = next.find((x) => x.id === id);
    const user = loadOperatorState().user;
    if (user && c) {
      pushActivity(
        user.id,
        `${c.name} marked ${c.status === "connected" ? "connected" : "not connected"} (local only — OAuth not live)`,
        "connection",
        c.id
      );
    }
  };

  const addMcp = () => {
    if (!mcpUrl.trim()) return;
    const next = addMcpConnection(mcpName || "Custom MCP", mcpUrl);
    setConnections(next);
    setMcpName("");
    setMcpUrl("");
    setShowMcp(false);
    const user = loadOperatorState().user;
    if (user) {
      pushActivity(
        user.id,
        "Custom MCP endpoint saved (tool discovery runtime not live yet)",
        "connection"
      );
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
          <p className="text-sm text-muted">
            Built-in research tools work without connections. OAuth providers and MCP tool
            execution are not live yet — entries are saved for Part 3.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-sm space-y-1">
          <div className="font-medium">Available now (no connection needed)</div>
          <div className="text-muted">web_search · web_page_reader · structured_data</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {connections.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted">{c.description}</div>
                  {c.mcpUrl && (
                    <div className="text-[11px] text-muted mt-1 break-all">{c.mcpUrl}</div>
                  )}
                </div>
                <span
                  className={`text-[11px] rounded-full px-2 py-0.5 ${
                    c.status === "connected"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {c.status === "connected" ? "Connected" : "Not connected"}
                </span>
              </div>
              <button
                onClick={() => onToggle(c.id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs self-start hover:bg-sidebar"
              >
                {c.status === "connected" ? "Disconnect (local)" : "Mark connected (local)"}
              </button>
            </div>
          ))}
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
                Saves endpoint metadata only. Live MCP tool discovery and execution ships in Part
                3. Do not paste secrets here.
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
