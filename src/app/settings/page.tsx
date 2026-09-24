"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  loadAppState,
  saveAppState,
  updateBusinessContext,
} from "@/lib/conversationStore";
import { AppState } from "@/types";
import Link from "next/link";

function isValidUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [website, setWebsite] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const s = loadAppState();
    if (!s.user) {
      router.replace("/signup");
      return;
    }
    setState(s);
    setTheme(s.theme || "system");
    const w = s.businessContext?.website || "";
    // Don't show incomplete "https://" as a saved value
    setWebsite(w === "https://" || w === "http://" ? "" : w);
  }, [router]);

  const applyTheme = (t: "light" | "dark" | "system") => {
    setTheme(t);
    saveAppState({ theme: t });
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else if (t === "light") root.classList.remove("dark");
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else root.classList.remove("dark");
  };

  const saveWebsite = () => {
    setMsg("");
    setErr("");
    const v = website.trim();
    if (!v) {
      updateBusinessContext({ website: "" });
      setMsg("Website cleared");
      return;
    }
    if (!isValidUrl(v)) {
      setErr("Enter a full URL starting with https://");
      return;
    }
    updateBusinessContext({ website: v });
    setMsg("Website saved");
  };

  if (!state?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-4 py-8 space-y-8 animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Account</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            <div className="px-4 py-3 flex justify-between text-sm">
              <span className="text-muted">Name</span>
              <span>{state.user.name}</span>
            </div>
            <div className="px-4 py-3 flex justify-between text-sm">
              <span className="text-muted">Email</span>
              <span className="truncate ml-4">{state.user.email}</span>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Business</h2>
          <Link
            href="/brain"
            className="block rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-indigo-200"
          >
            Open Business Brain
          </Link>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <label className="text-xs text-muted">Website</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              placeholder="Add your business website"
            />
            <button
              onClick={saveWebsite}
              className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Save website
            </button>
            {msg && <p className="text-xs text-emerald-600">{msg}</p>}
            {err && <p className="text-xs text-red-600">{err}</p>}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Theme</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => applyTheme(t)}
                  className={`flex-1 rounded-lg py-2 text-sm capitalize ${
                    theme === t
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-50 dark:bg-slate-800"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Session</h2>
          <button
            onClick={() => router.push("/login")}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Log out
          </button>
        </section>
      </div>
    </AppShell>
  );
}
