"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { loadOperatorState } from "@/lib/operatorStore";
import { applyTheme, readStoredTheme } from "@/lib/theme";
import { NexaLogo } from "@/components/NexaLogo";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/agents", label: "AI Team" },
  { href: "/connections", label: "Connections" },
  { href: "/vault", label: "Vault" },
  { href: "/settings", label: "Settings" },
  { href: "/plans", label: "Plans" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [name, setName] = useState("");

  useEffect(() => {
    applyTheme(readStoredTheme());
    const s = loadOperatorState();
    setName(s.user?.name || s.user?.email || "");
  }, []);

  const active = (href: string) =>
    pathname === href || (href !== "/home" && pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="hidden w-52 shrink-0 border-r border-zinc-200 bg-white px-3 py-5 dark:border-zinc-800 dark:bg-zinc-900 md:block">
          <div className="mb-8 px-2">
            <NexaLogo
              size={28}
              href="/home"
              wordmarkClassName="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            />
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Connect · Orchestrate
            </div>
          </div>
          <nav className="space-y-0.5">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active(item.href)
                    ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {name && (
            <div className="mt-8 border-t border-zinc-100 px-2 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {name}
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 md:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <NexaLogo
                size={24}
                href="/home"
                wordmarkClassName="font-semibold text-zinc-900 dark:text-zinc-50"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{name}</span>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${
                    active(item.href)
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="flex-1 text-zinc-900 dark:text-zinc-50">{children}</main>
        </div>
      </div>
    </div>
  );
}
