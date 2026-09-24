"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import { ActivityEvent } from "@/types";

export default function ActivityPage() {
  const router = useRouter();
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setEvents(s.activity || []);
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted">What Nexa has done recently</p>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
            No activity yet. Create a mission to get started.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {events.map((e) => (
              <div key={e.id} className="flex gap-4 px-4 py-3 text-sm">
                <div className="text-xs text-muted whitespace-nowrap pt-0.5">
                  {new Date(e.at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div>
                  <div>{e.text}</div>
                  {e.category && (
                    <div className="text-[11px] text-muted capitalize mt-0.5">{e.category}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
