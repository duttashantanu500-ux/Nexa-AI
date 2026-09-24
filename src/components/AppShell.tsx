"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Crosshair,
  Bot,
  Plug,
  Brain,
  Activity,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/missions", label: "Missions", icon: Crosshair },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/brain", label: "Business Brain", icon: Brain },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const NavItems = (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar only — no duplicate bottom nav */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            N
          </div>
          <button
            onClick={() => router.push("/home")}
            className="text-sm font-semibold tracking-tight"
          >
            Nexa
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pt-1">{NavItems}</div>
        <div className="p-4 border-t border-sidebar-border text-[11px] text-muted">
          AI Business Operator
        </div>
      </aside>

      {/* Mobile top bar + drawer (single nav pattern) */}
      <div className="md:hidden sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-3">
        <button onClick={() => setOpen(true)} className="p-1.5 rounded-md hover:bg-slate-100" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">Nexa</span>
        <div className="w-8" />
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex animate-fade-in">
          <div className="w-64 max-w-[80vw] bg-sidebar border-r border-border flex flex-col shadow-xl">
            <div className="flex h-12 items-center justify-between px-3 border-b border-sidebar-border">
              <span className="text-sm font-semibold">Nexa</span>
              <button onClick={() => setOpen(false)} className="p-1" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {NavItems}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}

      <main className="md:pl-[220px] min-h-screen">{children}</main>
    </div>
  );
}
