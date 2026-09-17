"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadAppState, saveAppState } from "@/lib/storage";
import { AppState } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const s = loadAppState();
    if (!s.user) {
      router.replace("/signup");
      return;
    }
    setState(s);
    setTheme(s.theme || "system");
  }, [router]);

  const applyTheme = (t: "light" | "dark" | "system") => {
    setTheme(t);
    saveAppState({ theme: t });

    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else if (t === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const handleLogout = () => {
    router.push("/login");
  };

  if (!state?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="p-1.5 rounded-md hover:bg-sidebar transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>

        {/* Profile */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Profile
          </h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-muted">Name</span>
              <span className="text-sm font-medium">{state.user.name}</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-muted">Email</span>
              <span className="text-sm font-medium">{state.user.email}</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-muted">Type</span>
              <span className="text-sm font-medium capitalize">
                {state.user.userType.replace("_", " ")}
              </span>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Appearance
          </h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => applyTheme(t)}
                  className={`flex-1 rounded-lg py-2 text-sm capitalize transition ${
                    theme === t
                      ? "bg-accent text-background"
                      : "bg-sidebar hover:bg-border"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Account */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Account
          </h2>
          <button
            onClick={handleLogout}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-left hover:bg-sidebar transition"
          >
            Log out
          </button>
        </section>

        <p className="text-xs text-muted text-center pt-4">
          Nexa — AI Business Growth Partner
        </p>
      </div>
    </div>
  );
}
