import "server-only";
import { cache } from "react";
import type { Permission, RoleName } from "../shared";
import { serverApiSafe } from "./api";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  avatarUrl?: string | null;
  branch?: { id: string; name: string } | null;
  permissions: Permission[];
}

// Both a layout and its page commonly call getSession() independently (e.g.
// admin/layout.tsx for the nav gate, admin/page.tsx to greet the user) —
// React's cache() memoizes this per request, so that's one /api/auth/me
// call per page load instead of one per caller.
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const data = await serverApiSafe<{ user: SessionUser }>("/api/auth/me");
  return data?.user ?? null;
});

export function can(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}
