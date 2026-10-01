"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  isSupabaseConfigured,
  signUpWithEmail,
  resendSignupConfirmation,
} from "@/lib/auth";
import { loadAppState } from "@/lib/conversationStore";
import { persistUserProfile, getStableUserId } from "@/lib/sessionUser";
import { NexaLogo } from "@/components/NexaLogo";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);
  const supabaseReady = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!supabaseReady) {
      setError("Account service is not available. Please try again later.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    const result = await signUpWithEmail({ email, password, name });
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.needsEmailConfirmation) {
      setAwaitingConfirm(true);
      setLoading(false);
      return;
    }

    const app = loadAppState();
    if (app.user?.id) {
      persistUserProfile({
        id: app.user.id,
        email: app.user.email || email.toLowerCase().trim(),
        name: name.trim() || app.user.name || "",
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

    getStableUserId();
    setLoading(false);
    router.push("/onboarding");
  };

  const handleResend = async () => {
    setResendMsg("");
    setResending(true);
    const r = await resendSignupConfirmation(email);
    setResending(false);
    if (r.error) {
      setResendMsg("Could not resend. Wait a minute and try again.");
      return;
    }
    setResendMsg("Confirmation email sent. Check your inbox.");
  };

  if (awaitingConfirm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <NexaLogo
              size={40}
              href="/"
              wordmarkClassName="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            />
          </div>
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
              disabled={resending}
              onClick={() => void handleResend()}
              className="mt-4 text-sm text-indigo-600 hover:underline disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend confirmation email"}
            </button>
            {resendMsg && (
              <p className="mt-2 text-xs text-zinc-500">{resendMsg}</p>
            )}
            <p className="mt-4 text-sm text-zinc-500">
              <Link href="/login" className="text-indigo-600 hover:underline">
                Back to log in
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
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="flex justify-center">
            <NexaLogo
              size={40}
              href="/"
              wordmarkClassName="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            />
          </div>
          <p className="text-sm text-zinc-500">Create your Nexa account</p>
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
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="At least 8 characters"
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
