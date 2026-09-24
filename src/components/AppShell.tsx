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

/** Figma nav — only primary product areas */
const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/missions", label: "Missions", icon: Crosshair },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/brain", label: "Business Brain", icon: Brain },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = NAV.slice(0, 4).concat([{ href: "/settings", label: "More", icon: Settings }]);

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
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] border-r border-border bg-sidebar md:flex md:flex-col">
        <div className="flex h-14 items-center px-5 border-b border-sidebar-border">
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

      <div className="md:hidden sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background px-3">
        <button onClick={() => setOpen(true)} className="p-1.5" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">Nexa</span>
        <div className="w-8" />
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 max-w-[80vw] bg-sidebar border-r border-border flex flex-col">
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

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="grid grid-cols-5 gap-0.5 px-1 py-1">
          {MOBILE_NAV.map((item) => {
            const active =
              item.label === "More"
                ? ["/settings", "/brain", "/activity"].some(
                    (p) => pathname === p || pathname.startsWith(p + "/")
                  )
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px]",
                  active ? "text-foreground font-medium" : "text-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="md:pl-[220px] pb-20 md:pb-0 min-h-screen">{children}</main>
    </div>
  );
}
