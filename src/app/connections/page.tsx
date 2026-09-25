"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import {
  CONNECTOR_REGISTRY,
  costLabelDisplay,
  statusLabel,
  type ConnectorUiStatus,
} from "@/lib/connectors/registry";
import { testComfyConnection } from "@/lib/connectors/localComfy";

const COMFY_KEY = "nexa_comfy_base_url";

type OAuthStatus = {
  providers: Record<
    string,
    { configured: boolean; connectPath: string | null }
  >;
};

export default function ConnectionsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [comfyUrl, setComfyUrl] = useState("");
  const [comfyStatus, setComfyStatus] = useState<"unknown" | "ok" | "fail">("unknown");
  const [comfyMsg, setComfyMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [oauth, setOauth] = useState<OAuthStatus | null>(null);
  const [banner, setBanner] = useState("");

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    try {
      setComfyUrl(localStorage.getItem(COMFY_KEY) || "");
    } catch {
      /* */
    }
    fetch("/api/oauth/status")
      .then((r) => r.json())
      .then((d) => setOauth(d))
      .catch(() => setOauth(null));

    const err = search.get("error");
    const connected = search.get("connected");
    if (err) setBanner(`Connection issue: ${err.replace(/_/g, " ")}`);
    if (connected) {
      setBanner(
        `${connected} authorization returned. Tokens must be stored server-side before actions can run.`
      );
    }
  }, [router, search]);

  const saveComfy = () => {
    try {
      localStorage.setItem(COMFY_KEY, comfyUrl.trim());
      setComfyMsg("Saved. Test the connection before running image workflows.");
      setComfyStatus("unknown");
    } catch {
      setComfyMsg("Could not save");
    }
  };

  const testComfy = async () => {
    setTesting(true);
    setComfyMsg("");
    const r = await testComfyConnection(comfyUrl);
    setComfyStatus(r.ok ? "ok" : "fail");
    setComfyMsg(r.message);
    if (r.ok) {
      try {
        localStorage.setItem(COMFY_KEY, comfyUrl.trim());
      } catch {
        /* */
      }
    }
    setTesting(false);
  };

  const resolveStatus = (id: string): ConnectorUiStatus => {
    const def = CONNECTOR_REGISTRY.find((c) => c.id === id);
    if (!def) return "unsupported";
    if (id === "local_data") return "connected";
    if (id === "local_comfyui") {
      return comfyStatus === "ok" || comfyUrl.trim()
        ? comfyStatus === "ok"
          ? "connected"
          : "setup_required"
        : "setup_required";
    }
    const p = oauth?.providers?.[id === "gmail" || id === "gdrive" || id === "gsheets" || id === "gcal" ? "google" : id];
    if (p?.configured) return "available";
    return def.defaultStatus;
  };

  const connectHref = (id: string): string | null => {
    if (id === "slack") return oauth?.providers?.slack?.connectPath || null;
    if (id === "notion") return oauth?.providers?.notion?.connectPath || null;
    if (id === "github") return oauth?.providers?.github?.connectPath || null;
    if (["gmail", "gdrive", "gsheets", "gcal"].includes(id))
      return oauth?.providers?.google?.connectPath || null;
    return null;
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold">Connections</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Bring your own tools. Nexa orchestrates authorized services — it does not invent results or switch providers silently.
          </p>
        </div>

        {banner && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {banner}
          </div>
        )}

        <div className="space-y-4">
          {CONNECTOR_REGISTRY.map((c) => {
            const status = resolveStatus(c.id);
            const href = connectHref(c.id);
            return (
              <div
                key={c.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <p className="mt-1 text-sm text-zinc-500">{c.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800">
                      {statusLabel(status)}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {costLabelDisplay(c.costLabel)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-400">{c.costNote}</p>
                {c.envHint && status === "setup_required" && (
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Admin env: {c.envHint}
                  </p>
                )}

                {c.id === "local_comfyui" && (
                  <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-zinc-500">Local endpoint URL</span>
                      <input
                        value={comfyUrl}
                        onChange={(e) => setComfyUrl(e.target.value)}
                        placeholder="http://127.0.0.1:8188"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={saveComfy} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700">
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={testing || !comfyUrl.trim()}
                        onClick={testComfy}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                      >
                        {testing ? "Testing…" : "Test connection"}
                      </button>
                    </div>
                    {comfyMsg && (
                      <p className={`text-xs ${comfyStatus === "ok" ? "text-emerald-600" : comfyStatus === "fail" ? "text-red-600" : "text-zinc-500"}`}>
                        {comfyMsg}
                      </p>
                    )}
                  </div>
                )}

                {c.id === "local_data" && (
                  <p className="mt-3 text-xs text-emerald-600">Always available · no setup</p>
                )}

                {href && (
                  <a
                    href={href}
                    className="mt-3 inline-block rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white"
                  >
                    Connect {c.name}
                  </a>
                )}

                {!href && c.connectionMethod === "oauth" && (
                  <p className="mt-3 text-xs text-amber-600">
                    Setup required — administrator must configure OAuth credentials. No fake Connect.
                  </p>
                )}

                {c.actions.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      Supported actions
                    </div>
                    <ul className="mt-1 text-xs text-zinc-500">
                      {c.actions.map((a) => (
                        <li key={a.id}>
                          {a.available ? "•" : "○"} {a.name}
                          {a.requiresApproval ? " (approval)" : ""}
                          {!a.available && a.unavailableReason
                            ? ` — ${a.unavailableReason}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
