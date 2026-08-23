import "server-only";
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

export async function getSession(): Promise<SessionUser | null> {
  const data = await serverApiSafe<{ user: SessionUser }>("/api/auth/me");
  return data?.user ?? null;
}

export function can(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}
