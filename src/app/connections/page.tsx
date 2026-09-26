"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { loadOperatorState } from "@/lib/operatorStore";
import {
  CONNECTOR_REGISTRY,
  statusBadgeClass,
  statusLabel,
  type ConnectorDefinition,
  type ConnectorUiStatus,
} from "@/lib/connectors/registry";

const COMFY_KEY = "nexa_comfy_base_url";

const SHORT: Record<string, string> = {
  notion: "Notes & documentation",
  slack: "Team communication",
  github: "Code & issues",
  gmail: "Email",
  gdrive: "Files",
  gsheets: "Spreadsheets",
  gcal: "Calendar",
  local_data: "Lists & reports",
  local_comfyui: "Local images",
};

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
  const [userId, setUserId] = useState("");
  const [notionStatus, setNotionStatus] = useState<ConnectorUiStatus | null>(null);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setUserId(s.user.id);
    try {
      setComfyOk(Boolean(localStorage.getItem(COMFY_KEY)?.trim()));
    } catch {
      /* */
    }
    const err = search.get("error");
    const connected = search.get("connected");
    if (err) setBanner(`Something went wrong: ${err.replace(/_/g, " ")}`);
    if (connected) setBanner("Connection updated.");

    fetch(`/api/connections/notion/status?userId=${encodeURIComponent(s.user.id)}`)
      .then((r) => r.json())
      .then((d) => setNotionStatus((d.status as ConnectorUiStatus) || null))
      .catch(() => null);
  }, [router, search]);

  const resolveStatus = (c: ConnectorDefinition): ConnectorUiStatus => {
    if (c.defaultStatus === "coming_soon") return "coming_soon";
    if (c.id === "local_data") return "connected";
    if (c.id === "local_comfyui") return comfyOk ? "connected" : "available";
    if (c.id === "notion" && notionStatus) return notionStatus;
    // Not ready for users yet → Coming soon (not "Unavailable")
    if (!c.executable || c.defaultStatus === "unavailable") return "coming_soon";
    return c.defaultStatus === "setup_required" ? "available" : c.defaultStatus;
  };

  const services = CONNECTOR_REGISTRY.filter(
    (c) => c.provider !== "builtin" && c.provider !== "comfyui"
  );
  const local = CONNECTOR_REGISTRY.filter(
    (c) => c.provider === "builtin" || c.provider === "comfyui"
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
            <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">{c.name}</span>
            <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {SHORT[c.id] || c.description}
          </p>
        </div>
      </Link>
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Connections</h1>
          <p className="mt-1 text-sm text-zinc-500">Connect the tools your agents use.</p>
        </div>

        {banner && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {banner}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Connected services
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Local tools
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {local.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
