"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadAppState, saveAppState } from "@/lib/conversationStore";
import { persistOnboardingCloud } from "@/lib/auth";
import { saveOperatorState } from "@/lib/operatorStore";
import { UserProfile } from "@/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const state = loadAppState();
    if (!state.user) {
      router.replace("/signup");
      return;
    }
    if (state.user.onboardingCompleted) {
      router.replace("/home");
      return;
    }
    setUser(state.user);
    setName(state.user.name || "");
  }, [router]);

  const handleFinish = async () => {
    if (!user) return;
    const trimmed = name.trim();
    const ageNum = parseInt(age, 10);
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }
    if (!age || Number.isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
      setError("Please enter a valid age (13+).");
      return;
    }

    setLoading(true);
    setError("");

    const updatedUser: UserProfile = {
      ...user,
      name: trimmed,
      age: ageNum,
      userType: user.userType || "founder",
      onboardingCompleted: true,
    };

    saveAppState({
      user: updatedUser,
      businessContext: { name: trimmed },
      memories: [],
      currentWorkspace: "strategy",
      currentConversationId: null,
      conversations: [],
    });
    saveOperatorState({ user: updatedUser, businessContext: { name: trimmed } });

    try {
      await persistOnboardingCloud({
        user: updatedUser,
        businessContext: { name: trimmed },
        memories: [],
      });
    } catch (err) {
      console.error("[Nexa] onboarding sync", err);
    }

    setLoading(false);
    router.push("/home");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm animate-pulse-soft">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="max-w-md mx-auto space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="mx-auto h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
            N
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Nexa</h1>
          <p className="text-muted text-sm">Your AI Business Operator. Just two quick details.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Age</label>
            <input
              type="number"
              min={13}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="18"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleFinish}
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 text-white py-3 text-sm font-medium hover:bg-indigo-500 transition disabled:opacity-50"
          >
            {loading ? "Setting up…" : "Continue to Home"}
          </button>
        </div>
      </div>
    </div>
  );
}
