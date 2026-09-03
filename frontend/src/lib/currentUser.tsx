"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "./session";

// UI-only convenience — lets a deeply nested client component (e.g. a modal
// several levels under a page) know the current user's permissions without
// its own /auth/me round-trip. Never used to authorize an action: every
// endpoint enforces its own permission checks server-side regardless of
// what this says, matching packages/shared/src/permissions.ts's own
// "frontend only hides/shows controls" rule.
const CurrentUserContext = createContext<SessionUser | null>(null);

export function CurrentUserProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): SessionUser | null {
  return useContext(CurrentUserContext);
}
