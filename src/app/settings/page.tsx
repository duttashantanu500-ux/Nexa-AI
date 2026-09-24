"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  clearSession,
  loadOperatorState,
  setTheme,
  setUser,
} from "@/lib/operatorStore";

export default function SettingsPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [theme, setThemeLocal] = useState<"light" | "dark" | "system">("system");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setName(s.user.name || "");
    setEmail(s.user.email || "");
    setAge(s.user.age != null ? String(s.user.age) : "");
    setThemeLocal(s.theme || "system");
  }, [router]);

  const saveProfile = () => {
    const s = loadOperatorState();
    if (!s.user) return;
    setUser({
      ...s.user,
      name: name.trim() || s.user.name,
      age: age ? parseInt(age, 10) : s.user.age,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const changeTheme = (t: "light" | "dark" | "system") => {
    setThemeLocal(t);
    setTheme(t);
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else if (t === "light") root.classList.remove("dark");
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches)
      root.classList.add("dark");
    else root.classList.remove("dark");
  };

  const logout = () => {
    clearSession();
    router.replace("/login");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-8 px-4 py-8">
        <h1 className="text-xl font-semibold">Settings</h1>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Profile
          </h2>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Email</span>
            <input
              value={email}
              disabled
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Age</span>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="button"
            onClick={saveProfile}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          >
            {saved ? "Saved" : "Save profile"}
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Theme
          </h2>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => changeTheme(t)}
                className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                  theme === t
                    ? "bg-indigo-600 text-white"
                    : "border border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 dark:border-red-900"
          >
            Log out
          </button>
        </section>
      </div>
    </AppShell>
  );
}
