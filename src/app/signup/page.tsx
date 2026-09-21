"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isSupabaseConfigured,
  signUpWithEmail,
  signInWithGoogle,
} from "@/lib/auth";
import { createId, saveAppState } from "@/lib/conversationStore";
import { UserProfile } from "@/types";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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

    if (supabaseReady) {
      const result = await signUpWithEmail({ email, password, name });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setLoading(false);
      router.push("/onboarding");
      return;
    }

    // Local fallback when Supabase env is not set
    const user: UserProfile = {
      id: createId(),
      email: email.toLowerCase().trim(),
      name: name.trim(),
      userType: "founder",
      createdAt: new Date().toISOString(),
      onboardingCompleted: false,
    };
    localStorage.setItem(
      "nexa_auth",
      JSON.stringify({ email: user.email, password })
    );
    saveAppState({ user });
    setLoading(false);
    router.push("/onboarding");
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
    // Redirect handled by OAuth
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Nexa</h1>
          <p className="text-muted text-sm">Your AI Business Growth Partner</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="What should Nexa call you?"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="At least 6 characters"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent text-background py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
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
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
