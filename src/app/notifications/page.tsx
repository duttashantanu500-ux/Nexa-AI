"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { loadOperatorState } from "@/lib/operatorStore";
import {
  AppNotification,
  loadNotifications,
  markAllRead,
  markNotificationRead,
} from "@/lib/notifications";
import Link from "next/link";

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [userId, setUserId] = useState("");

  const refresh = (uid: string) => setItems(loadNotifications(uid));

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    setUserId(s.user.id);
    refresh(s.user.id);
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted">Mission and approval alerts</p>
          </div>
          {userId && (
            <button
              onClick={() => {
                markAllRead(userId);
                refresh(userId);
              }}
              className="text-xs text-muted hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
            No notifications yet.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border border-border bg-card px-4 py-3 ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <div className="flex justify-between gap-2">
                  <div className="text-sm font-medium">{n.title}</div>
                  <span className="text-[11px] text-muted">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted mt-1">{n.body}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  {!n.read && (
                    <button
                      onClick={() => {
                        markNotificationRead(n.id);
                        refresh(userId);
                      }}
                      className="text-muted hover:text-foreground"
                    >
                      Mark read
                    </button>
                  )}
                  {n.refId && (
                    <Link
                      href={`/missions/${n.refId}`}
                      className="text-sky-600 hover:underline"
                    >
                      Open mission
                    </Link>
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
