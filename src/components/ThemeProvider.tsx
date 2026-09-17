"use client";

import { useEffect } from "react";
import { loadAppState } from "@/lib/storage";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const state = loadAppState();
    const theme = state.theme || "system";
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, []);

  return <>{children}</>;
}
