"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import { ActivityEvent } from "@/types";

export default function ActivityPage() {
  const router = useRouter();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setEvents(s.activity || []);
    setLoaded(true);
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted mt-1">
            Real events only — mission created, completed, failed, agent created.
          </p>
        </div>

        {!loaded ? (
          <div className="text-sm text-muted">Loading…</div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
            No activity yet.
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-border bg-card px-4 py-3 flex gap-3 text-sm"
              >
                <span className="text-xs text-muted whitespace-nowrap shrink-0">
                  {new Date(e.at).toLocaleString()}
                </span>
                <span>{e.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
