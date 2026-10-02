"use client";

import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/lib/authHeaders";

type UiStatus = "available" | "connected" | "error" | "loading";

type ToolRow = {
  name: string;
  description: string;
};

export function McpConnectionPanel({
  userId,
  onStatus,
}: {
  userId: string;
  onStatus?: (s: UiStatus) => void;
}) {
  const [status, setStatus] = useState<UiStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState("");
  const [label, setLabel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [host, setHost] = useState("");
  const [discovered, setDiscovered] = useState<ToolRow[]>([]);
  const [approved, setApproved] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const applyStatus = useCallback(
    (s: UiStatus) => {
      setStatus(s);
      onStatus?.(s);
    },
    [onStatus]
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/connections/mcp/status", { headers });
      const data = await res.json();
      const st = (data.status as UiStatus) || "available";
      applyStatus(
        st === "connected" ? "connected" : st === "error" ? "error" : "available"
      );
      setHost(data.endpointHost || "");
      if (data.label) setLabel(data.label);
      const tools: ToolRow[] = Array.isArray(data.discoveredTools)
        ? data.discoveredTools.map(
            (t: { name: string; description?: string }) => ({
              name: t.name,
              description: t.description || "",
            })
          )
        : [];
      setDiscovered(tools);
      const ap: string[] = Array.isArray(data.approvedTools)
        ? data.approvedTools
        : [];
      setApproved(ap);
      const sel: Record<string, boolean> = {};
      for (const t of tools) sel[t.name] = ap.includes(t.name);
      setSelected(sel);
    } catch {
      applyStatus("available");
    }
  }, [userId, applyStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    if (!userId) return;
    const url = endpoint.trim();
    if (!url) {
      setBanner("Enter the address of your server.");
      return;
    }
    setBusy(true);
    setBanner("");
    applyStatus("loading");
    try {
      const headers = await authHeaders({
        "Content-Type": "application/json",
      });
      const res = await fetch("/api/connections/mcp/connect", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          endpoint: url,
          authorization: authToken.trim() || undefined,
          label: label.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        applyStatus("error");
        setBanner(
          data.message || "Could not connect. Check the address and try again."
        );
        setBusy(false);
        return;
      }
      setBanner(
        data.message ||
          "Connected. Review the tools below and choose which ones your AI employees may use."
      );
      setEndpoint("");
      setAuthToken("");
      await refresh();
    } catch {
      applyStatus("error");
      setBanner("Could not reach this server. Please try again.");
    }
    setBusy(false);
  };

  const saveApprovals = async () => {
    if (!userId) return;
    setBusy(true);
    setBanner("");
    const tools = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([name]) => name);
    try {
      const headers = await authHeaders({
        "Content-Type": "application/json",
      });
      const res = await fetch("/api/connections/mcp/approve", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, tools }),
      });
      const data = await res.json();
      setBanner(data.message || (data.ok ? "Saved." : "Could not save."));
      if (data.ok) await refresh();
    } catch {
      setBanner("Could not save your choices.");
    }
    setBusy(false);
  };

  const test = async () => {
    if (!userId) return;
    setBusy(true);
    setBanner("");
    try {
      const headers = await authHeaders({
        "Content-Type": "application/json",
      });
      const res = await fetch("/api/connections/mcp/test", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(
        data.message ||
          (data.ok ? "Connected successfully." : "Couldn't reach this server.")
      );
      await refresh();
    } catch {
      setBanner("Couldn't reach this server.");
    }
    setBusy(false);
  };

  const disconnect = async () => {
    if (!userId) return;
    if (!confirm("Remove this custom connection from Nexa?")) return;
    setBusy(true);
    try {
      const headers = await authHeaders({
        "Content-Type": "application/json",
      });
      const res = await fetch("/api/connections/mcp/disconnect", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setBanner(data.message || "Disconnected.");
      setDiscovered([]);
      setApproved([]);
      setSelected({});
      setHost("");
      applyStatus("available");
    } catch {
      setBanner("Could not disconnect.");
    }
    setBusy(false);
  };

  const connected = status === "connected";

  return (
    <div className="space-y-4">
      {banner && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {banner}
        </div>
      )}

      {!connected && (
        <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Add your own connection
          </h2>
          <p className="text-xs text-zinc-500">
            Enter a name and the secure address of your server. Nexa will check
            that it responds and list the tools it offers.
          </p>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My tools"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Server address</span>
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">
              Access key (optional)
            </span>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Only if your server requires one"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void connect()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Connecting…" : "Connect"}
          </button>
        </section>
      )}

      {connected && (
        <>
          <section className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Connection</h2>
            {label && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{label}</p>
            )}
            {host && (
              <p className="break-all text-xs text-zinc-500">{host}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => void test()}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                {busy ? "Working…" : "Test connection"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void refresh().then(() => setBanner("Tool list updated."))
                }
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
              >
                Refresh tools
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void disconnect()}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
              >
                Disconnect
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Tools</h2>
            <p className="text-xs text-zinc-500">
              Choose which tools your AI employees may use. New tools stay off until you
              allow them.
            </p>
            {discovered.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No tools found on this server.
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {discovered.map((t) => (
                  <li
                    key={t.name}
                    className="flex items-start gap-3 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(selected[t.name])}
                      onChange={(e) =>
                        setSelected((prev) => ({
                          ...prev,
                          [t.name]: e.target.checked,
                        }))
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium break-all">
                          {t.name}
                        </span>
                        {approved.includes(t.name) && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Allowed
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {discovered.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveApprovals()}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save allowed tools"}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
