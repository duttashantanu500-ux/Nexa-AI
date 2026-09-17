"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadAppState } from "@/lib/storage";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const state = loadAppState();

    if (!state.user) {
      router.replace("/signup");
      return;
    }

    if (!state.user.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }

    router.replace("/chat");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="text-2xl font-semibold tracking-tight">Nexa</div>
        <p className="text-sm text-muted">Loading your workspace…</p>
      </div>
    </div>
  );
}
