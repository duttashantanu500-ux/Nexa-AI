"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { loadOperatorState } from "@/lib/operatorStore";
import { getStableUserId } from "@/lib/sessionUser";
import {
  getConnector,
  statusBadgeClass,
  statusLabel,
} from "@/lib/connectors/registry";

export default function ConnectorDetailPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="px-4 py-12 text-center text-sm text-zinc-500">Loading…</div>
        </AppShell>
      }
    >
      <ConnectorDetailInner />
    </Suspense>
  );
}

function ConnectorDetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const connector = getConnector(id);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    const uid = (s.user?.id || getStableUserId() || "").trim();
    if (!uid) {
      router.replace("/signup");
      return;
    }
    setReady(true);
  }, [router]);

  if (!connector) {
    return (
      <AppShell>
        <div className="px-4 py-16 text-center text-sm text-zinc-500">
          Not found.{" "}
          <Link href="/connections" className="text-indigo-600">
            Back
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!ready) {
    return (
      <AppShell>
        <div className="px-4 py-12 text-center text-sm text-zinc-500">Loading…</div>
      </AppShell>
    );
  }

  const connectHref =
    connector.id === "slack"
      ? "/api/oauth/slack/start"
      : connector.id === "notion"
        ? "/api/oauth/notion/start"
        : connector.id === "buffer"
          ? "/api/oauth/buffer/start"
          : connector.id === "hubspot"
            ? "/api/oauth/hubspot/start"
            : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <Link href="/connections" className="text-xs text-zinc-500 hover:text-indigo-600">
            ← Connections
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
              <ConnectorLogo id={connector.id} size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {connector.name}
                </h1>
                <span className={statusBadgeClass("available")}>{statusLabel("available")}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {connector.detailDescription || connector.description}
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connect or manage this tool so your AI employees can use it. Status updates on the
          Connections list after you finish connecting.
        </p>

        <div className="flex flex-wrap gap-2">
          {connectHref && (
            <a
              href={connectHref}
              className="inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
            >
              Connect {connector.name}
            </a>
          )}
          <Link
            href="/connections"
            className="inline-flex rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Back to Connections
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
