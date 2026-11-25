"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isSupabaseConfigured,
  resendSignupEmail,
  signInWithEmail,
} from "@/lib/auth";
import { loadAppState } from "@/lib/conversationStore";
import { loadOperatorState } from "@/lib/operatorStore";
import { persistUserProfile, getStableUserId } from "@/lib/sessionUser";
import Link from "next/link";
import { NexaLogo } from "@/components/NexaLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const supabaseReady = isSupabaseConfigured();

  const goAfterLogin = () => {
    getStableUserId();
    const op = loadOperatorState();
    const app = loadAppState();
    const done =
      op.user?.onboardingCompleted || app.user?.onboardingCompleted;
    if (!done) router.push("/onboarding");
    else router.push("/home");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setNeedsConfirm(false);
    setLoading(true);

    if (!supabaseReady) {
      setError("Account service is not available. Please try again later.");
      setLoading(false);
      return;
    }

    const result = await signInWithEmail({ email, password });
    if (result.error) {
      setError(result.error);
      setNeedsConfirm(Boolean(result.needsEmailConfirm));
      setLoading(false);
      return;
    }

    const app = loadAppState();
    if (app.user?.id) {
      persistUserProfile({
        id: app.user.id,
        email: app.user.email || email.toLowerCase().trim(),
        name: app.user.name || "",
        userType: app.user.userType || "founder",
        createdAt: app.user.createdAt || new Date().toISOString(),
        onboardingCompleted: Boolean(app.user.onboardingCompleted),
      });
    }

    try {
      localStorage.removeItem("nexa_auth");
    } catch {
      /* */
    }

    setLoading(false);
    goAfterLogin();
  };

  const handleResend = async () => {
    if (!email.trim() || resending) return;
    setResending(true);
    setError("");
    setInfo("");
    const r = await resendSignupEmail(email);
    setResending(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setInfo("Verification email sent. Check your inbox and spam folder.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-3 text-center">
          <NexaLogo
            size={40}
            href="/"
            wordmarkClassName="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          />
          <p className="text-sm text-zinc-500">Welcome back</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="you@company.com"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs text-indigo-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Your password"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}

          {needsConfirm && (
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending || !email.trim()}
              className="w-full rounded-lg border border-zinc-200 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          No account?{" "}
          <Link href="/signup" className="text-indigo-600 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
