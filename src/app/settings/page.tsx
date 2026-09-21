"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadAppState,
  saveAppState,
  updateBusinessContext,
} from "@/lib/conversationStore";
import { AppState } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [website, setWebsite] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const s = loadAppState();
    if (!s.user) {
      router.replace("/signup");
      return;
    }
    setState(s);
    setTheme(s.theme || "system");
    setWebsite(s.businessContext?.website || "");
    setSummary(s.businessContext?.websiteSummary || "");
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

  const saveWebsite = async (reanalyze: boolean) => {
    setBusy(true);
    setMsg("");
    const clean = website.trim();
    let nextSummary = summary;

    if (!clean) {
      updateBusinessContext({ website: "", websiteSummary: "" });
      setSummary("");
      setMsg("Website removed.");
      setBusy(false);
      return;
    }

    if (reanalyze) {
      try {
        const res = await fetch("/api/analyze-website", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: clean }),
        });
        const data = await res.json();
        nextSummary = data.summary || "";
        setSummary(nextSummary);
      } catch {
        nextSummary = summary;
      }
    }

    updateBusinessContext({
      website: clean,
      websiteSummary: nextSummary || undefined,
    });
    setMsg(reanalyze ? "Website saved and analyzed." : "Website saved.");
    setBusy(false);
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
          <Link href="/chat" className="p-1.5 rounded-md hover:bg-sidebar transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Profile</h2>
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
            {state.businessContext?.businessName && (
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-muted">Business</span>
                <span className="text-sm font-medium">{state.businessContext.businessName}</span>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Website</h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://your-site.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {summary && (
              <p className="text-xs text-muted leading-relaxed">{summary.slice(0, 320)}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() => saveWebsite(true)}
                className="rounded-lg bg-accent text-background px-3 py-2 text-sm disabled:opacity-50"
              >
                {busy ? "Working…" : "Save & analyze"}
              </button>
              <button
                disabled={busy}
                onClick={() => saveWebsite(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Save only
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setWebsite("");
                  setSummary("");
                  updateBusinessContext({ website: "", websiteSummary: "" });
                  setMsg("Website removed.");
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted"
              >
                Remove
              </button>
            </div>
            {msg && <p className="text-xs text-muted">{msg}</p>}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Appearance</h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => applyTheme(t)}
                  className={`flex-1 rounded-lg py-2 text-sm capitalize transition ${
                    theme === t ? "bg-accent text-background" : "bg-sidebar hover:bg-border"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Account</h2>
          <button
            onClick={() => router.push("/login")}
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
