"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { loadOperatorState } from "@/lib/operatorStore";
import { getStableUserId } from "@/lib/sessionUser";
import {
  CONNECTOR_REGISTRY,
  statusBadgeClass,
  statusLabel,
  type ConnectorDefinition,
  type ConnectorUiStatus,
} from "@/lib/connectors/registry";

const COMFY_KEY = "nexa_comfy_base_url";
const STATUS_CACHE_KEY = "nexa_conn_status_v1";

function readStatusCache(): Partial<Record<string, ConnectorUiStatus>> {
  try {
    const raw = sessionStorage.getItem(STATUS_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<string, ConnectorUiStatus>>;
  } catch {
    return {};
  }
}

function writeStatusCache(map: Record<string, ConnectorUiStatus>) {
  try {
    sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* */
  }
}

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
  const [storageWarning, setStorageWarning] = useState("");
  const [comfyOk, setComfyOk] = useState(false);
  const [notionStatus, setNotionStatus] = useState<ConnectorUiStatus | null>(null);
  const [slackStatus, setSlackStatus] = useState<ConnectorUiStatus | null>(null);
  const [bufferStatus, setBufferStatus] = useState<ConnectorUiStatus | null>(null);
  const [ideogramStatus, setIdeogramStatus] = useState<ConnectorUiStatus | null>(null);
  const [mcpStatus, setMcpStatus] = useState<ConnectorUiStatus | null>(null);
  const [hubspotStatus, setHubspotStatus] = useState<ConnectorUiStatus | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    // Seed from session cache so we never flash "Checking…" on revisit
    const cached = readStatusCache();
    if (cached.notion) setNotionStatus(cached.notion);
    if (cached.slack) setSlackStatus(cached.slack);
    if (cached.buffer) setBufferStatus(cached.buffer);
    if (cached.ideogram) setIdeogramStatus(cached.ideogram);
    if (cached.mcp) setMcpStatus(cached.mcp);
    if (cached.hubspot) setHubspotStatus(cached.hubspot);
    if (Object.keys(cached).length > 0) setStatusLoaded(true);

    const s = loadOperatorState();
    // Prefer real session user id so status matches OAuth token storage
    const uid = (s.user?.id || getStableUserId() || "").trim();
    if (!uid) {
      router.replace("/signup");
      return;
    }
    if (s.user && !s.user.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
    try {
      setComfyOk(Boolean(localStorage.getItem(COMFY_KEY)?.trim()));
    } catch {
      /* */
    }
    const err = search.get("error");
    const connected = (search.get("connected") || "").toLowerCase();
    if (connected) {
      setBanner("Connected successfully.");
      // Optimistic: show Connected immediately for the returned connector
      if (connected.includes("notion")) setNotionStatus("connected");
      if (connected.includes("slack")) setSlackStatus("connected");
      if (connected.includes("buffer")) setBufferStatus("connected");
      if (connected.includes("hubspot")) setHubspotStatus("connected");
      if (connected.includes("ideogram")) setIdeogramStatus("connected");
      if (connected.includes("mcp")) setMcpStatus("connected");
    } else if (err) {
      setBanner(
        "Could not finish connecting. If the tool still shows Connected below, you are fine."
      );
    }

    const load = async () => {
      if (!uid) {
        setStatusLoaded(true);
        return;
      }
      // Parallel: storage health is advisory only; status is the critical path
      const healthP = fetch("/api/connections/storage-health")
        .then((r) => r.json())
        .then((h) => {
          if (h?.warning) setStorageWarning(String(h.warning));
        })
        .catch(() => {});
      try {
        // Single batch call — persisted tokens only, one DB query, no remote health
        const batchRes = await fetch(
          `/api/connections/status?userId=${encodeURIComponent(uid)}`,
          { cache: "no-store" }
        );
        const batch = await batchRes.json().catch(() => ({}));
        const st = (batch?.statuses || {}) as Record<string, { status?: string }>;
        const statuses = {
          notion: (st.notion?.status as ConnectorUiStatus) || "available",
          slack: (st.slack?.status as ConnectorUiStatus) || "available",
          buffer: (st.buffer?.status as ConnectorUiStatus) || "available",
          ideogram: (st.ideogram?.status as ConnectorUiStatus) || "available",
          mcp: (st.mcp?.status as ConnectorUiStatus) || "available",
          hubspot: (st.hubspot?.status as ConnectorUiStatus) || "available",
        };
        setNotionStatus(statuses.notion);
        setSlackStatus(statuses.slack);
        setBufferStatus(statuses.buffer);
        setIdeogramStatus(statuses.ideogram);
        setMcpStatus(statuses.mcp);
        setHubspotStatus(statuses.hubspot);
        writeStatusCache(statuses);
        // Prefer truth: if any live status is connected, never leave an error banner
        if (Object.values(statuses).some((s) => s === "connected") && connected) {
          setBanner("Connected successfully.");
        } else if (
          Object.values(statuses).some((s) => s === "connected") &&
          err
        ) {
          setBanner("Connected successfully.");
        }
      } catch {
        /* keep previous */
      } finally {
        setStatusLoaded(true);
      }
      void healthP;
    };
    void load();

    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router, search]);

  const resolveStatus = (c: ConnectorDefinition): ConnectorUiStatus => {
    const live: Record<string, ConnectorUiStatus | null> = {
      notion: notionStatus,
      slack: slackStatus,
      buffer: bufferStatus,
      ideogram: ideogramStatus,
      mcp: mcpStatus,
      hubspot: hubspotStatus,
    };
    if (c.id in live) {
      const s = live[c.id];
      if (s === "connected") return "connected";
      if (s === "error") return "error";
      if (s === "unavailable") return "unavailable";
      if (s === "available") return "available";
      // Prefer last-known / available over long "Checking…"
      return statusLoaded ? "available" : "available";
    }
    if (c.id === "local_comfyui") return comfyOk ? "connected" : "available";
    if (c.id === "local_data" || c.id === "vault") return "connected";
    if (c.defaultStatus === "coming_soon") return "coming_soon";
    return c.defaultStatus;
  };

  const services = CONNECTOR_REGISTRY.filter(
    (c) => !["local_data", "local_comfyui", "vault"].includes(c.id)
  );
  const local = CONNECTOR_REGISTRY.filter((c) =>
    ["local_data", "local_comfyui", "vault"].includes(c.id)
  );

  const Card = ({ c }: { c: ConnectorDefinition }) => {
    const status = resolveStatus(c);
    return (
      <Link
        href={`/connections/${c.id}`}
        className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
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
          <p className="mt-0.5 truncate text-xs text-zinc-500">{c.shortDescription}</p>
        </div>
      </Link>
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Connections</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Connect tools your AI employees can use. Status reflects your saved connections.
          </p>
        </div>

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

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Connected services
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Local</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {local.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
