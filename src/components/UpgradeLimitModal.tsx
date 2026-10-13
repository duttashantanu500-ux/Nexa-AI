"use client";

import { RobotAvatar } from "@/components/robots/RobotAvatar";
import { startProCheckout } from "@/lib/clientBilling";
import { useState } from "react";

type Props = {
  open: boolean;
  message: string;
  onClose: () => void;
  /** Optional detail under the main message */
  detail?: string;
};

/**
 * Friendly plan-limit gate: LEGO bot + Uh-oh copy + upgrade CTA.
 */
export function UpgradeLimitModal({ open, message, onClose, detail }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const upgrade = async () => {
    setBusy(true);
    setErr("");
    const r = await startProCheckout();
    if (r.ok && r.checkoutUrl) {
      window.location.href = r.checkoutUrl;
      return;
    }
    setErr(r.message || "Could not open checkout.");
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-limit-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-col items-center text-center">
          <RobotAvatar id="cobalt" size="xl" className="mb-3" animated />
          <h2
            id="upgrade-limit-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Uh oh
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            {message}
          </p>
          {detail ? (
            <p className="mt-1 text-xs text-zinc-500">{detail}</p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              You can always unlock more by upgrading to Pro.
            </p>
          )}
        </div>

        {err && (
          <p className="mt-3 text-center text-xs text-red-600">{err}</p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void upgrade()}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Opening checkout…" : "Upgrade to Pro — $9/mo"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-zinc-200 py-2.5 text-sm dark:border-zinc-700"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
