"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { PageHeader } from "@/components/PageHeader";
import { loadOperatorState } from "@/lib/operatorStore";
import { getStableUserId } from "@/lib/sessionUser";
import {
  CONNECTOR_REGISTRY,
  statusBadgeClass,
  statusLabel,
  type ConnectorDefinition,
  type ConnectorUiStatus,
} from "@/lib/connectors/registry";

export default function ConnectionsPage() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<
    Record<string, { status?: ConnectorUiStatus; message?: string }>
  >({});
  const [banner, setBanner] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const resolveStatus = useCallback(
    (c: ConnectorDefinition): ConnectorUiStatus => {
      if (c.id === "local_data" || c.id === "vault") return "connected";
      if (c.id === "local_comfyui") {
        try {
          return localStorage.getItem("nexa_comfy_base_url")?.trim()
            ? "connected"
            : "available";
        } catch {
          return "available";
               }
      }
      const row = statuses[c.id];
      return (row?.status as ConnectorUiStatus) || c.defaultStatus || "available";
    },
    [statuses]
  );

  useEffect(() => {
    const s = loadOperatorState();
    const uid = (s.user?.id || getStableUserId() || "").trim();
    if (!uid) {
      router.replace("/login");
      return;
    }
    if (s.user && !s.user.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }

    let cancelled = false;
    (async () => {
      const healthP = fetch("/api/connections/storage-health")
        .then((r) => r.json().catch(() => ({})))
        .catch(() => ({}));

      try {
        const res = await fetch(
          `/api/connections/status?userId=${encodeURIComponent(uid)}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.statuses) setStatuses(data.statuses);
      } catch {
        /* ignore */
      }

      const health = await healthP;
      if (!cancelled && health?.warning) {
        setStorageWarning(String(health.warning));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of CONNECTOR_REGISTRY) {
      if (c.category) set.add(c.category);
    }
    return ["All", ...Array.from(set)];
  }, []);

  const services = useMemo(
    () =>
      CONNECTOR_REGISTRY.filter(
        (c) => !["local_data", "local_comfyui", "vault"].includes(c.id)
      ),
    []
  );

  const local = useMemo(
    () =>
      CONNECTOR_REGISTRY.filter((c) =>
        ["local_data", "local_comfyui", "vault"].includes(c.id)
      ),
    []
  );

  const filteredServices = useMemo(() => {
    if (categoryFilter === "All") return services;
    return services.filter((c) => c.category === categoryFilter);
  }, [services, categoryFilter]);

  const Card = ({ c }: { c: ConnectorDefinition }) => {
    const status = resolveStatus(c);
    // Prefer clean paths; status query is optional UX only.
    const href = `/connections/${c.id}`;
    return (
      <Link
        href={href}
        prefetch={true}
        // Hard-nav fallback: some mobile browsers drop client-side Link transitions.
        onClick={(e) => {
          try {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            window.location.assign(href);
          } catch {
            /* let default Link handle */
          }
        }}
        className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition active:bg-zinc-50 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:active:bg-zinc-800 dark:hover:border-indigo-700"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
          <ConnectorLogo id={c.id} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {c.name}
            </span>
            <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {c.shortDescription}
            {c.category ? (
              <span className="ml-1 text-zinc-400">· {c.category}</span>
            ) : null}
          </p>
        </div>
      </Link>
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <PageHeader
          page="connections"
          title="Connections"
          subtitle="Connect tools your AI employees can use. Status reflects your saved connections."
        />

        {banner && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            {banner}
          </div>
        )}
        {storageWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {storageWarning}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={
                categoryFilter === cat
                  ? "rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              }
            >
              {cat}
            </button>
          ))}
        </div>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Connected services
          </h2>
          <div className="space-y-2">
            {filteredServices.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Local
          </h2>
          <div className="space-y-2">
            {local.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
