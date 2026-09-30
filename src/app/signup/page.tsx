"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isSupabaseConfigured,
  signUpWithEmail,
  signInWithGoogle,
  resendSignupEmail,
} from "@/lib/auth";
import { persistUserProfile } from "@/lib/sessionUser";
import { UserProfile } from "@/types";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const supabaseReady = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password || !name) {
      setError("Please fill in all fields.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    if (!supabaseReady) {
      setError("Account service is not available. Please try again later.");
      setLoading(false);
      return;
    }

    const result = await signUpWithEmail({ email, password, name });
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.needsConfirmation) {
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
      setAwaitingConfirm(true);
      setLoading(false);
      return;
    }

    if (result.userId) {
      const user: UserProfile = {
        id: result.userId,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        onboardingCompleted: false,
      };
      persistUserProfile(user);
      try {
        localStorage.setItem(
          "nexa_auth",
          JSON.stringify({ email: user.email, password })
        );
      } catch {
        /* */
      }
      setLoading(false);
      router.push("/onboarding");
      return;
    }

    setError("Could not create account.");
    setLoading(false);
  };

  const handleResend = async () => {
    setResendBusy(true);
    setResendMsg("");
    const r = await resendSignupEmail(email);
    setResendBusy(false);
    if (r.error) {
      setResendMsg("Could not resend. Wait a minute and try again.");
      return;
    }
    setResendMsg("Confirmation email sent. Check your inbox.");
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

  if (awaitingConfirm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-indigo-600">
            Nexa
          </h1>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-left dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Check your email
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              We sent a confirmation link to{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {email}
              </span>
              . Open it to activate your account, then log in.
            </p>
            <button
              type="button"
              disabled={resendBusy}
              onClick={() => void handleResend()}
              className="mt-4 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 disabled:opacity-50"
            >
              {resendBusy ? "Sending…" : "Resend confirmation"}
            </button>
            {resendMsg && (
              <p className="mt-2 text-xs text-indigo-600">{resendMsg}</p>
            )}
            <p className="mt-4 text-sm text-zinc-500">
              <Link href="/login" className="text-indigo-600 hover:underline">
                Go to login
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-indigo-600">
            Nexa
          </h1>
          <p className="text-sm text-zinc-500">AI Agent Operating System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Your name"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="you@email.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="At least 6 characters"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900 disabled:opacity-50"
        >
          Continue with Google
        </button>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
