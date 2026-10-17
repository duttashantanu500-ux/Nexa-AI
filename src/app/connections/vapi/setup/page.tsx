"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ConnectorLogo } from "@/components/ConnectorLogo";
import { loadOperatorState } from "@/lib/operatorStore";
import { getStableUserId } from "@/lib/sessionUser";
import { authHeaders } from "@/lib/authHeaders";

/**
 * Dedicated Vapi private API key setup page (BYOA).
 * Mirrors Ideogram flow: paste key → verify → store encrypted.
 */
export default function VapiSetupPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [alreadyConnected, setAlreadyConnected] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    const uid = getStableUserId() || s.user?.id || "";
    if (!uid) {
      router.replace("/login");
      return;
    }
    if (s.user && !s.user.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
    setUserId(uid);
    void (async () => {
      try {
        const res = await fetch(
          `/api/connections/vapi/status?userId=${encodeURIComponent(uid)}`
        );
        const data = await res.json();
        if (data.status === "connected") setAlreadyConnected(true);
      } catch {
        /* */
      }
    })();
  }, [router]);

  const connect = async () => {
    if (!userId) return;
    const key = apiKey.trim();
    if (!key) {
      setOk(false);
      setMessage("Paste your Vapi private API key to continue.");
      return;
    }
    setBusy(true);
    setMessage("");
    setOk(null);
    try {
      const headers = await authHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/connections/vapi/connect", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, apiKey: key }),
      });
      const data = await res.json();
      if (data.ok) {
        setOk(true);
        setMessage(data.message || "Your Vapi account is connected.");
        setApiKey("");
        setAlreadyConnected(true);
        setTimeout(() => router.push("/connections/vapi"), 1200);
      } else {
        setOk(false);
        setMessage(data.message || "Could not connect. Check your key and try again.");
      }
    } catch {
      setOk(false);
      setMessage("Something went wrong. Please try again.");
    }
    setBusy(false);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <Link
            href="/connections/vapi"
            className="text-xs text-zinc-500 hover:text-indigo-600"
          >
            ← Vapi
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <ConnectorLogo id="vapi" size={28} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Connect Vapi
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Add your Vapi private API key so your AI employees can use voice assistants and
                calls with your account.
              </p>
            </div>
          </div>
        </div>

        {alreadyConnected && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Vapi is already connected. You can replace the key below if needed.
          </div>
        )}

        <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            How to get your private API key
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              Open{" "}
              <a
                href="https://dashboard.vapi.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                dashboard.vapi.ai
              </a>{" "}
              and sign in.
            </li>
            <li>
              Go to{" "}
              <a
                href="https://dashboard.vapi.ai/org/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                Organization → API Keys
              </a>
              .
            </li>
            <li>
              Create or copy a <strong>Private</strong> API key (not a public key).
            </li>
            <li>Paste the key into the field below and click Connect.</li>
          </ol>
          <p className="text-xs text-zinc-500">
            Official docs:{" "}
            <a
              href="https://docs.vapi.ai/api-reference/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              Vapi API overview
            </a>
          </p>
        </section>

        <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Safety rules
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              <strong>Never share</strong> your private API key in chat, email, screenshots, or
              public repos.
            </li>
            <li>
              Treat the key like a password. Anyone with it can use your Vapi account and billing.
            </li>
            <li>
              Nexa stores your key <strong>encrypted</strong> for your account only. It is not shown
              again after you connect.
            </li>
            <li>
              You can disconnect anytime from Connections → Vapi to remove the stored key.
            </li>
            <li>
              Voice and call usage is billed by <strong>Vapi</strong> — not by Nexa.
            </li>
          </ul>
        </section>

        <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Enter your private API key
          </h2>
          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-500">Vapi private API key</span>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your private key here"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void connect();
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="shrink-0 rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <p className="text-xs text-zinc-500">
            The key is sent only to Nexa over HTTPS, verified with Vapi, then stored encrypted. It
            is cleared from this form after a successful connect.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !apiKey.trim()}
              onClick={() => void connect()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Connecting…" : alreadyConnected ? "Update & connect" : "Connect"}
            </button>
            <Link
              href="/connections/vapi"
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Cancel
            </Link>
          </div>
          {message && (
            <div
              className={
                ok
                  ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              }
            >
              {message}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
