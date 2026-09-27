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
    // Ensure both stores share the same user id before navigating
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

    if (supabaseReady) {
      const result = await signInWithEmail({ email, password });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // hydrateLocalFromCloud already ran; sync operatorStore
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
      setLoading(false);
      goAfterLogin();
      return;
    }

    // Local fallback
    const stored = localStorage.getItem("nexa_auth");
    if (!stored) {
      setError("No account found. Please sign up.");
      setLoading(false);
      return;
    }

    try {
      const auth = JSON.parse(stored);
      if (
        auth.email === email.toLowerCase().trim() &&
        auth.password === password
      ) {
        getStableUserId();
        const op = loadOperatorState();
        const app = loadAppState();
        if (op.user || app.user) {
          goAfterLogin();
        } else {
          setError("Session data missing. Please sign up again.");
        }
      } else {
        setError("Invalid email or password.");
      }
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    if (!supabaseReady) {
      setError("Add Supabase keys in Vercel to use Google sign-in.");
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Nexa</h1>
          <p className="text-muted text-sm">Welcome back</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@company.com"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Your password"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent text-background py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full rounded-lg border border-border bg-card py-2.5 text-sm font-medium hover:bg-sidebar transition disabled:opacity-50"
        >
          Continue with Google
        </button>

        <p className="text-center text-sm text-muted">
          No account?{" "}
          <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
