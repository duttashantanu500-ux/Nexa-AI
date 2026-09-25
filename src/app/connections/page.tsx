"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import {
  CONNECTOR_REGISTRY,
  statusBadgeClass,
  statusLabel,
  type ConnectorUiStatus,
} from "@/lib/connectors/registry";

const COMFY_KEY = "nexa_comfy_base_url";

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="px-4 py-12 text-center text-sm text-zinc-500">Loading…</div>
        </AppShell>
      }
    >
      <ConnectionsInner />
    </Suspense>
  );
}

function ConnectionsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [banner, setBanner] = useState("");
  const [comfyOk, setComfyOk] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    try {
      const url = localStorage.getItem(COMFY_KEY);
      setComfyOk(Boolean(url?.trim()));
    } catch {
      /* */
    }
    const err = search.get("error");
    const connected = search.get("connected");
    if (err) setBanner(`Connection issue: ${err.replace(/_/g, " ")}`);
    if (connected) {
      setBanner(
        `${connected} returned from authorization. Full token storage is still required before actions run.`
      );
    }
  }, [router, search]);

  const resolveStatus = (id: string): ConnectorUiStatus => {
    const def = CONNECTOR_REGISTRY.find((c) => c.id === id);
    if (!def) return "unavailable";
    if (def.defaultStatus === "coming_soon") return "coming_soon";
    if (id === "local_data") return "connected";
    if (id === "local_comfyui") return comfyOk ? "connected" : "available";
    // OAuth connectors: do not show Connected without verified backend token
    return def.defaultStatus === "setup_required" ? "unavailable" : def.defaultStatus;
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Connections</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Connect the tools your agents use.
          </p>
        </div>

        {banner && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {banner}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {CONNECTOR_REGISTRY.map((c) => {
            const status = resolveStatus(c.id);
            return (
              <Link
                key={c.id}
                href={`/connections/${c.id}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {c.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {c.name}
                    </span>
                    <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{c.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
