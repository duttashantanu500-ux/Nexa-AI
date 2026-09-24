"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState, updateConnection } from "@/lib/operatorStore";
import { Connection } from "@/types";

export default function ConnectionsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpBusy, setMcpBusy] = useState(false);
  const [mcpMsg, setMcpMsg] = useState("");

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setConnections(s.connections);
  }, [router]);

  const refresh = () => setConnections(loadOperatorState().connections);

  const connectMcp = async () => {
    if (!mcpUrl.trim()) return;
    setMcpBusy(true);
    setMcpMsg("");
    try {
      const res = await fetch("/api/mcp/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mcpUrl.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMcpMsg(data.error || "Could not connect");
        updateConnection("mcp", {
          status: "available",
          mcpUrl: mcpUrl.trim(),
          mcpTools: [],
        });
      } else {
        updateConnection("mcp", {
          status: "connected",
          mcpUrl: mcpUrl.trim(),
          mcpTools: data.tools || [],
          tools: data.tools || [],
        });
        setMcpMsg(`Connected · ${(data.tools || []).length} tools found`);
      }
      refresh();
    } catch {
      setMcpMsg("Network error");
    } finally {
      setMcpBusy(false);
    }
  };

  const disconnectMcp = () => {
    updateConnection("mcp", {
      status: "available",
      mcpUrl: undefined,
      mcpTools: [],
      tools: [],
    });
    setMcpUrl("");
    setMcpMsg("");
    refresh();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold">Connections</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Connect services your agents can use. Only verified connections show
            as connected.
          </p>
        </div>

        <div className="space-y-3">
          {connections.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <p className="mt-0.5 text-sm text-zinc-500">{c.description}</p>
                </div>
                <Status status={c.status} />
              </div>

              {c.id === "web" && (
                <p className="mt-2 text-xs text-zinc-400">
                  Built-in · web search and page reading are available to agents
                </p>
              )}

              {c.id === "mcp" && (
                <div className="mt-3 space-y-2">
                  {c.status === "connected" ? (
                    <>
                      <p className="text-xs text-zinc-500">
                        {(c.mcpTools || c.tools || []).length} tools discovered
                      </p>
                      <button
                        type="button"
                        onClick={disconnectMcp}
                        className="text-xs text-red-600"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        value={mcpUrl}
                        onChange={(e) => setMcpUrl(e.target.value)}
                        placeholder="https://your-mcp-server.example/sse"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <button
                        type="button"
                        disabled={mcpBusy || !mcpUrl.trim()}
                        onClick={connectMcp}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                      >
                        {mcpBusy ? "Connecting…" : "Connect MCP"}
                      </button>
                      {mcpMsg && (
                        <p className="text-xs text-zinc-500">{mcpMsg}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {c.status === "not_supported" && (
                <p className="mt-2 text-xs text-zinc-400">
                  This integration is not available yet.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Status({ status }: { status: string }) {
  const map: Record<string, string> = {
    connected: "bg-emerald-50 text-emerald-700",
    available: "bg-sky-50 text-sky-700",
    not_connected: "bg-zinc-100 text-zinc-600",
    setup_required: "bg-amber-50 text-amber-700",
    not_supported: "bg-zinc-100 text-zinc-500",
  };
  const label =
    status === "not_supported"
      ? "Not available"
      : status === "not_connected"
        ? "Not connected"
        : status.replace("_", " ");
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${map[status] || map.not_connected}`}
    >
      {label}
    </span>
  );
}
