"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  loadOperatorState,
  toggleConnection,
  pushActivity,
} from "@/lib/operatorStore";
import { Connection, DEFAULT_CONNECTIONS } from "@/types";

export default function ConnectionsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>(DEFAULT_CONNECTIONS);

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
        `${c.name} marked ${c.status === "connected" ? "connected" : "not connected"} (demo)`,
        "connection",
        c.id
      );
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
          <p className="text-sm text-muted">
            Connect business tools Nexa can use later. OAuth and MCP execution are not live in Part 1.
          </p>
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
                {c.status === "connected" ? "Disconnect (demo)" : "Connect (demo)"}
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted space-y-2">
          <div className="font-medium text-foreground text-sm">+ Connect tool</div>
          <div>+ Add custom MCP</div>
          <p className="text-xs">
            Secure authentication and MCP execution will be added in later parts.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
