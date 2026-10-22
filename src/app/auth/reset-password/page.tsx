"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { updatePassword } from "@/lib/auth";

/**
 * Password recovery page.
 * Supabase may land here with either:
 * - a session already set by /auth/callback (PKCE / token_hash)
 * - or hash fragments (#access_token=...&type=recovery) that still need setSession
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function ensureRecoverySession() {
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) {
          setError("Account service is not available.");
          setReady(true);
        }
        return;
      }

      try {
        // 1) Hash-based recovery links (access_token in fragment)
        if (typeof window !== "undefined" && window.location.hash) {
          const hash = window.location.hash.replace(/^#/, "");
          const params = new URLSearchParams(hash);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          const type = params.get("type");

          if (access_token && (type === "recovery" || type === "magiclink" || !type)) {
            const { error: setErr } = await sb.auth.setSession({
              access_token,
              refresh_token: refresh_token || "",
            });
            if (setErr) {
              console.warn("reset-password setSession", setErr.message);
            } else {
              // Clear hash so a refresh does not re-process a one-time token
              try {
                window.history.replaceState(
                  null,
                  "",
                  window.location.pathname + window.location.search
                );
              } catch {
                /* */
              }
            }
          }
        }

        // 2) Query params (token_hash) — rare on this route but safe
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          const tokenHash = url.searchParams.get("token_hash");
          const type = url.searchParams.get("type");
          if (tokenHash && (type === "recovery" || type === "email")) {
            await sb.auth.verifyOtp({
              token_hash: tokenHash,
              type: type === "recovery" ? "recovery" : "email",
            });
          }
        }

        // 3) Confirm we have a session (from callback or hash)
        const { data } = await sb.auth.getSession();
        if (!cancelled) {
          setSessionOk(Boolean(data.session?.user));
          if (!data.session?.user) {
            setError(
              "This reset link is invalid, expired, or already used. Request a new one from the login page."
            );
          }
          setReady(true);
        }
      } catch (e) {
        console.error("reset-password session", e);
        if (!cancelled) {
          setError(
            "Could not verify the reset link. Request a new one from the login page."
          );
          setReady(true);
        }
      }
    }

    void ensureRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!sessionOk) {
      setError(
        "This reset link is invalid or expired. Request a new one from the login page."
      );
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.error) {
      const msg = result.error || "";
      if (/session|jwt|token|expired|invalid/i.test(msg)) {
        setError(
          "This reset link has expired or was already used. Request a new password reset email."
        );
      } else {
        setError(
          "Could not update password. Request a new reset link from the login page."
        );
      }
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/login"), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-indigo-600">
            Nexa
          </h1>
          <p className="text-sm text-zinc-500">Choose a new password</p>
        </div>

        {!ready ? (
          <p className="text-center text-sm text-zinc-500">Verifying reset link…</p>
        ) : done ? (
          <p className="text-center text-sm text-zinc-600">
            Password updated. Redirecting to login…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="At least 6 characters"
                autoFocus
                disabled={!sessionOk}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Repeat password"
                disabled={!sessionOk}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading || !sessionOk}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Saving…" : "Update password"}
            </button>
            <p className="text-center text-sm text-zinc-500">
              <Link href="/login" className="text-indigo-600 hover:underline">
                Back to login
              </Link>
              {" · "}
              <Link
                href="/forgot-password"
                className="text-indigo-600 hover:underline"
              >
                Request a new link
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
