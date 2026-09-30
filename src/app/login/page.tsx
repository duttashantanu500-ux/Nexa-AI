"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isSupabaseConfigured,
  signInWithEmail,
  signInWithGoogle,
} from "@/lib/auth";
import { loadAppState } from "@/lib/conversationStore";
import { loadOperatorState } from "@/lib/operatorStore";
import { persistUserProfile, getStableUserId } from "@/lib/sessionUser";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
    setLoading(true);

    if (!supabaseReady) {
      setError("Account service is not available. Please try again later.");
      setLoading(false);
      return;
    }

    const result = await signInWithEmail({ email, password });
    if (result.error) {
      setError(result.error);
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
      localStorage.setItem(
        "nexa_auth",
        JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        })
      );
    } catch {
      /* */
    }

    setLoading(false);
    goAfterLogin();
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    if (!supabaseReady) {
      setError("Google sign-in is not available right now.");
      setLoading(false);
      return;
    }
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-indigo-600">
            Nexa
          </h1>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-zinc-50 px-2 text-zinc-500 dark:bg-zinc-950">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900 disabled:opacity-50"
        >
          Continue with Google
        </button>

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
