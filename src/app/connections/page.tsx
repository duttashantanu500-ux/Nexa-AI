"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import {
  CONNECTOR_REGISTRY,
  costLabelDisplay,
} from "@/lib/connectors/registry";
import { testComfyConnection } from "@/lib/connectors/localComfy";

const COMFY_KEY = "nexa_comfy_base_url";

export default function ConnectionsPage() {
  const router = useRouter();
  const [comfyUrl, setComfyUrl] = useState("");
  const [comfyStatus, setComfyStatus] = useState<"unknown" | "ok" | "fail">("unknown");
  const [comfyMsg, setComfyMsg] = useState("");
  const [testing, setTesting] = useState(false);

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
  }, [router]);

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

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold">Connections</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Nexa runs work through services you connect. We do not silently switch
            providers or invent results.
          </p>
        </div>

        <div className="space-y-4">
          {CONNECTOR_REGISTRY.filter((c) => c.id !== "web_search").map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <p className="mt-1 text-sm text-zinc-500">{c.description}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800">
                  {costLabelDisplay(c.costLabel)}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">{c.costNote}</p>

              {c.id === "local_comfyui" && (
                <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-zinc-500">
                      Local endpoint URL
                    </span>
                    <input
                      value={comfyUrl}
                      onChange={(e) => setComfyUrl(e.target.value)}
                      placeholder="http://127.0.0.1:8188"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveComfy}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-700"
                    >
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
                    <p
                      className={`text-xs ${
                        comfyStatus === "ok"
                          ? "text-emerald-600"
                          : comfyStatus === "fail"
                            ? "text-red-600"
                            : "text-zinc-500"
                      }`}
                    >
                      {comfyMsg}
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-400">
                    Model licenses may restrict commercial use. Nexa does not host
                    models or pay for generation.
                  </p>
                </div>
              )}

              {c.id === "local_data" && (
                <p className="mt-3 text-xs text-emerald-600">Always available · no setup</p>
              )}

              {!c.executable && c.id !== "local_comfyui" && (
                <p className="mt-3 text-xs text-amber-600">
                  Not available yet — no fake Connect button.
                </p>
              )}

              {c.actions.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Actions
                  </div>
                  <ul className="mt-1 text-xs text-zinc-500">
                    {c.actions.map((a) => (
                      <li key={a.id}>
                        {a.available ? "•" : "○"} {a.name}
                        {!a.available && a.unavailableReason
                          ? ` — ${a.unavailableReason}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
