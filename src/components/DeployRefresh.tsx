"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "nexa_build_id";
const POLL_MS = 45_000;

/**
 * When a new production deploy goes live, soft-reload the tab so users get
 * the new UI without signing out or clearing cookies.
 * Session cookies + localStorage are kept; only the page code is refreshed.
 */
export function DeployRefresh() {
  const checking = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (checking.current || cancelled) return;
      checking.current = true;
      try {
        const res = await fetch(`/api/build-id?t=${Date.now()}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as {
          buildId?: string;
        } | null;
        const remote = (data?.buildId || "").trim();
        if (!remote) return;

        const local = sessionStorage.getItem(STORAGE_KEY);
        if (!local) {
          sessionStorage.setItem(STORAGE_KEY, remote);
          return;
        }
        if (local !== remote) {
          sessionStorage.setItem(STORAGE_KEY, remote);
          // Full navigation reload picks up new JS/CSS; auth cookies stay.
          window.location.reload();
        }
      } catch {
        /* offline / transient — ignore */
      } finally {
        checking.current = false;
      }
    };

    void check();
    const id = window.setInterval(() => void check(), POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
