/**
 * Stable client-side user identity for connectors.
 * operatorStore and conversationStore must share the same user id.
 */

import { loadOperatorState, setUser } from "./operatorStore";
import { loadAppState, saveAppState } from "./conversationStore";
import type { UserProfile } from "@/types";

/**
 * Returns the signed-in Nexa user id used for connector ownership.
 * Syncs operatorStore ↔ app state so Connections always use the same id
 * that OAuth used when saving tokens.
 */
export function getStableUserId(): string {
  if (typeof window === "undefined") return "";

  const op = loadOperatorState();
  const app = loadAppState();

  const opUser = op.user;
  const appUser = app.user;

  // Prefer existing operator user (Connections / agents use this)
  if (opUser?.id) {
    // Keep app state in sync
    if (!appUser?.id || appUser.id !== opUser.id) {
      saveAppState({
        user: {
          ...(appUser || opUser),
          id: opUser.id,
          email: opUser.email || appUser?.email || "",
          name: opUser.name || appUser?.name || "",
          onboardingCompleted:
            opUser.onboardingCompleted ?? appUser?.onboardingCompleted ?? false,
          userType: opUser.userType || appUser?.userType || "founder",
          createdAt: opUser.createdAt || appUser?.createdAt || new Date().toISOString(),
        } as UserProfile,
      });
    }
    return opUser.id;
  }

  // Fall back to app state (login/hydrate path)
  if (appUser?.id) {
    setUser({
      id: appUser.id,
      email: appUser.email || "",
      name: appUser.name || "",
      userType: appUser.userType || "founder",
      createdAt: appUser.createdAt || new Date().toISOString(),
      onboardingCompleted: Boolean(appUser.onboardingCompleted),
    });
    return appUser.id;
  }

  return "";
}

/** Write the same profile into both stores. */
export function persistUserProfile(user: UserProfile): void {
  setUser(user);
  saveAppState({ user });
}
