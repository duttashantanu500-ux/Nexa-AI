import { createId, loadAppState, saveAppState } from "./conversationStore";

export type NotificationKind =
  | "mission_completed"
  | "mission_failed"
  | "approval_required"
  | "schedule"
  | "opportunity"
  | "system";

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  refId?: string;
  read: boolean;
  createdAt: string;
}

const KEY = "nexa_notifications_v1";

export function loadNotifications(userId: string): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as AppNotification[]) : [];
    return all
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function saveAll(list: AppNotification[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
}

export function pushNotification(
  userId: string,
  kind: NotificationKind,
  title: string,
  body: string,
  refId?: string
): AppNotification {
  const n: AppNotification = {
    id: createId(),
    userId,
    kind,
    title,
    body,
    refId,
    read: false,
    createdAt: new Date().toISOString(),
  };
  try {
    const raw = localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as AppNotification[]) : [];
    saveAll([n, ...all]);
  } catch {
    /* ignore */
  }
  return n;
}

export function markNotificationRead(id: string) {
  try {
    const raw = localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as AppNotification[]) : [];
    saveAll(all.map((n) => (n.id === id ? { ...n, read: true } : n)));
  } catch {
    /* */
  }
}

export function markAllRead(userId: string) {
  try {
    const raw = localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as AppNotification[]) : [];
    saveAll(
      all.map((n) => (n.userId === userId ? { ...n, read: true } : n))
    );
  } catch {
    /* */
  }
}

/** Keep AppState in sync for digest counts */
export function touchActivityDigest(userId: string) {
  const state = loadAppState();
  if (state.user?.id !== userId) return;
  saveAppState({});
}
