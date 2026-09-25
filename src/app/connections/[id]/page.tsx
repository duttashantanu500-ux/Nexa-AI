"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import {
  connectionMethodLabel,
  costLabelDisplay,
  getConnector,
  statusBadgeClass,
  statusLabel,
  type ConnectorUiStatus,
} from "@/lib/connectors/registry";
import { testComfyConnection } from "@/lib/connectors/localComfy";

const COMFY_KEY = "nexa_comfy_base_url";

type OAuthStatus = {
  providers: Record<string, { configured: boolean; connectPath: string | null }>;
};

export default function ConnectorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const connector = getConnector(id);

  const [oauth, setOauth] = useState<OAuthStatus | null>(null);
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
    fetch("/api/oauth/status")
      .then((r) => r.json())
      .then((d) => setOauth(d))
      .catch(() => setOauth(null));
  }, [router]);

  if (!connector) {
    return (
      <AppShell>
        <div className="px-4 py-16 text-center text-sm text-zinc-500">
          Connector not found.{" "}
          <Link href="/connections" className="text-indigo-600">
            Back
          </Link>
        </div>
      </AppShell>
    );
  }

  const resolveStatus = (): ConnectorUiStatus => {
    if (connector.defaultStatus === "coming_soon") return "coming_soon";
    if (connector.id === "local_data") return "connected";
    if (connector.id === "local_comfyui") {
      return comfyStatus === "ok" || comfyUrl.trim() ? "connected" : "available";
    }
    const key =
      connector.id === "gmail" ||
      connector.id === "gdrive" ||
      connector.id === "gsheets" ||
      connector.id === "gcal"
        ? "google"
        : connector.id;
    const p = oauth?.providers?.[key];
    // Never show Connected without verified token storage
    if (p?.configured && connector.executable) return "available";
    if (connector.defaultStatus === "setup_required") return "unavailable";
    return connector.defaultStatus;
  };

  const status = resolveStatus();

  const connectHref = (): string | null => {
    if (status === "coming_soon" || status === "unavailable") return null;
    if (connector.id === "slack") return oauth?.providers?.slack?.connectPath || null;
    if (connector.id === "notion") return oauth?.providers?.notion?.connectPath || null;
    if (connector.id === "github") return oauth?.providers?.github?.connectPath || null;
    return null;
  };

  const href = connectHref();
  const canShowConnect =
    Boolean(href) &&
    (status === "available" || status === "error") &&
    connector.connectionMethod === "oauth";

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

  const readActions = connector.actions.filter((a) => a.readOnly);
  const writeActions = connector.actions.filter((a) => !a.readOnly);
  const approvalActions = connector.actions.filter((a) => a.requiresApproval);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <Link href="/connections" className="text-xs text-zinc-500 hover:text-indigo-600">
            ← Connections
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {connector.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {connector.name}
                </h1>
                <span className={statusBadgeClass(status)}>{statusLabel(status)}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {connector.detailDescription || connector.description}
              </p>
            </div>
          </div>
        </div>

        {/* Connect / configure */}
        {status === "coming_soon" && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            This integration is not available yet. No connect action is offered.
          </div>
        )}

        {status === "unavailable" && connector.connectionMethod === "oauth" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Not available to connect on this deployment. OAuth is not configured end-to-end (no
            fake Connect button).
          </div>
        )}

        {canShowConnect && href && (
          <a
            href={href}
            className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            Connect {connector.name}
          </a>
        )}

        {connector.id === "local_data" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Built-in and ready — no connection step required.
          </div>
        )}

        {connector.id === "local_comfyui" && (
          <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Configure endpoint</h2>
            <label className="block space-y-1">
              <span className="text-xs text-zinc-500">Local URL</span>
              <input
                value={comfyUrl}
                onChange={(e) => setComfyUrl(e.target.value)}
                placeholder="http://127.0.0.1:8188"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Overview</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <dt className="text-[11px] uppercase text-zinc-400">Connection method</dt>
              <dd>{connectionMethodLabel(connector.connectionMethod)}</dd>
            </div>
            <div className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <dt className="text-[11px] uppercase text-zinc-400">Cost</dt>
              <dd>{costLabelDisplay(connector.costLabel)}</dd>
            </div>
          </dl>
          <p className="text-xs text-zinc-500">{connector.costNote}</p>
        </section>

        {connector.scopes && connector.scopes.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Permissions & scopes</h2>
            <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
              {connector.scopes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Supported actions</h2>
          {connector.actions.length === 0 ? (
            <p className="text-sm text-zinc-500">No actions registered yet.</p>
          ) : (
            <ul className="space-y-2">
              {connector.actions.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <div className="font-medium">{a.name}</div>
                  <p className="text-xs text-zinc-500">{a.description}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-zinc-400">
                    <span>{a.readOnly ? "Read-only" : "Write"}</span>
                    {a.requiresApproval && <span>Requires approval</span>}
                    {!a.implemented && <span>Not implemented</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(readActions.length > 0 || writeActions.length > 0) && (
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
              <div className="text-[11px] font-medium uppercase text-zinc-400">Read-only</div>
              <ul className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {readActions.map((a) => (
                  <li key={a.id}>{a.name}</li>
                ))}
                {readActions.length === 0 && <li>—</li>}
              </ul>
            </div>
            <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
              <div className="text-[11px] font-medium uppercase text-zinc-400">Write</div>
              <ul className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {writeActions.map((a) => (
                  <li key={a.id}>{a.name}</li>
                ))}
                {writeActions.length === 0 && <li>—</li>}
              </ul>
            </div>
          </section>
        )}

        {approvalActions.length > 0 && (
          <section className="space-y-1">
            <h2 className="text-sm font-semibold">Requires approval</h2>
            <p className="text-xs text-zinc-500">
              These write actions pause the run until you approve.
            </p>
            <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
              {approvalActions.map((a) => (
                <li key={a.id}>{a.name}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
