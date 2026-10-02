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
 * Dedicated Ideogram API key setup page.
 * Guides users through creating a key and stores it encrypted server-side.
 */
export default function IdeogramSetupPage() {
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
          `/api/connections/ideogram/status?userId=${encodeURIComponent(uid)}`
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
      setMessage("Paste your Ideogram API key to continue.");
      return;
    }
    setBusy(true);
    setMessage("");
    setOk(null);
    try {
      const headers = await authHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/connections/ideogram/connect", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, apiKey: key }),
      });
      const data = await res.json();
      if (data.ok) {
        setOk(true);
        setMessage(data.message || "Your Ideogram account is connected.");
        setApiKey("");
        setAlreadyConnected(true);
        setTimeout(() => router.push("/connections/ideogram"), 1200);
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
            href="/connections/ideogram"
            className="text-xs text-zinc-500 hover:text-indigo-600"
          >
            ← Ideogram
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <ConnectorLogo id="ideogram" size={28} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Connect Ideogram
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Add your Ideogram API key so your AI employees can generate images using your account.
              </p>
            </div>
          </div>
        </div>

        {alreadyConnected && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Ideogram is already connected. You can replace the key below if needed.
          </div>
        )}

        {/* How to get your key */}
        <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            How to get your API key
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              Open{" "}
              <a
                href="https://ideogram.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                ideogram.ai
              </a>{" "}
              and sign in to your account.
            </li>
            <li>
              Go to the{" "}
              <a
                href="https://ideogram.ai/manage-api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                API Dashboard
              </a>{" "}
              (or Account menu → API keys).
            </li>
            <li>Accept the Developer API Agreement if prompted.</li>
            <li>
              Add a payment method if Ideogram requires it for API access (API billing is separate
              from your Ideogram subscription).
            </li>
            <li>
              Open the <strong>API Keys</strong> tab and choose <strong>Create key</strong>.
            </li>
            <li>
              Copy the full key immediately — Ideogram only shows it once.
            </li>
            <li>Paste the key into the field below and click Connect.</li>
          </ol>
          <p className="text-xs text-zinc-500">
            Official docs:{" "}
            <a
              href="https://developer.ideogram.ai/ideogram-api/api-setup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              Ideogram API setup
            </a>
          </p>
        </section>

        {/* Safety rules */}
        <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Safety rules
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              <strong>Never share</strong> your API key in chat, email, screenshots, or public repos.
            </li>
            <li>
              Treat the key like a password. Anyone with it can use your Ideogram credits.
            </li>
            <li>
              Nexa stores your key <strong>encrypted</strong> for your account only. It is not shown
              again after you connect.
            </li>
            <li>
              You can disconnect anytime from Connections → Ideogram to remove the stored key.
            </li>
            <li>
              If a key may have been exposed, revoke it in the Ideogram API Dashboard and create a
              new one.
            </li>
            <li>
              Image generation uses <strong>your</strong> Ideogram billing and rate limits.
            </li>
          </ul>
        </section>

        {/* Secure key entry */}
        <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Enter your API key
          </h2>
          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-500">Ideogram API key</span>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your key here"
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
            The key is sent only to Nexa over HTTPS, verified with Ideogram, then stored encrypted.
            It is cleared from this form after a successful connect.
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
              href="/connections/ideogram"
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
