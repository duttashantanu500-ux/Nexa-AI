/**
 * Stable client-side user identity for connectors.
 * operatorStore and conversationStore must share the same user id.
 *
 * The id is also pinned under localStorage key nexa_stable_user_id so a
 * partial store reset cannot mint a new id and orphan saved connections.
 */

import { loadOperatorState, setUser } from "./operatorStore";
import { loadAppState, saveAppState } from "./conversationStore";
import type { UserProfile } from "@/types";

const STABLE_ID_KEY = "nexa_stable_user_id";

function readPinnedId(): string {
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem(STABLE_ID_KEY) || "").trim();
  } catch {
    return "";
  }
}

function pinId(id: string): void {
  if (typeof window === "undefined" || !id?.trim()) return;
  try {
    localStorage.setItem(STABLE_ID_KEY, id.trim());
  } catch {
    /* */
  }
}

/**
 * Returns the signed-in Nexa user id used for connector ownership.
 * Syncs operatorStore ↔ app state so Connections always use the same id
 * that OAuth used when saving tokens.
 */
export function getStableUserId(): string {
  if (typeof window === "undefined") return "";

  const op = loadOperatorState();
  const app = loadAppState();
  const pinned = readPinnedId();

  const opUser = op.user;
  const appUser = app.user;

  // 1) Prefer operator user, but never abandon a pinned id if it matches
  if (opUser?.id) {
    const id = opUser.id;
    // If we already pinned a different id, keep the pinned one (source of truth for tokens)
    const useId = pinned && pinned !== id ? pinned : id;
    if (!pinned || pinned !== useId) pinId(useId);

    if (useId !== id) {
      // Realign operator profile to pinned id
      setUser({ ...opUser, id: useId });
    }

    if (!appUser?.id || appUser.id !== useId) {
      saveAppState({
        user: {
          ...(appUser || opUser),
          id: useId,
          email: opUser.email || appUser?.email || "",
          name: opUser.name || appUser?.name || "",
          onboardingCompleted:
            opUser.onboardingCompleted ?? appUser?.onboardingCompleted ?? false,
          userType: opUser.userType || appUser?.userType || "founder",
          createdAt: opUser.createdAt || appUser?.createdAt || new Date().toISOString(),
        } as UserProfile,
      });
    }
    return useId;
  }

  // 2) App state
  if (appUser?.id) {
    const useId = pinned && pinned !== appUser.id ? pinned : appUser.id;
    pinId(useId);
    setUser({
      id: useId,
      email: appUser.email || "",
      name: appUser.name || "",
      userType: appUser.userType || "founder",
      createdAt: appUser.createdAt || new Date().toISOString(),
      onboardingCompleted: Boolean(appUser.onboardingCompleted),
    });
    if (appUser.id !== useId) {
      saveAppState({ user: { ...appUser, id: useId } });
    }
    return useId;
  }

  // 3) Pinned only (stores empty but we still know who the user is)
  if (pinned) return pinned;

  return "";
}

/** Write the same profile into both stores and pin the id. */
export function persistUserProfile(user: UserProfile): void {
  pinId(user.id);
  setUser(user);
  saveAppState({ user });
}
