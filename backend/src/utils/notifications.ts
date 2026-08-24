import { prisma } from "../lib/prisma";
import type { Permission } from "../shared";
import { hasPermission } from "../shared";

type NotificationType =
  | "BUY_REQUEST_NEW"
  | "BUY_REQUEST_REFERRED"
  | "BUY_REQUEST_STATUS_CHANGED"
  | "SALE_COMPLETED"
  | "LOW_STOCK"
  | "REVIEW_SUBMITTED"
  | "USER_CREATED"
  | "SYSTEM";

// Types a user can opt out of via User.notificationPrefs. Anything not in
// this list (referrals landing directly on you, system notices) is always
// created — matches "critical notifications should not be disabled".
const OPTIONAL_TYPES = new Set<NotificationType>([
  "BUY_REQUEST_NEW",
  "SALE_COMPLETED",
  "LOW_STOCK",
  "REVIEW_SUBMITTED",
]);

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

function isOptedOut(prefs: unknown, type: NotificationType): boolean {
  if (!OPTIONAL_TYPES.has(type)) return false;
  if (!prefs || typeof prefs !== "object") return false;
  const value = (prefs as Record<string, unknown>)[type];
  return value === false;
}

/**
 * Creates a single notification, unless the recipient has opted out of this
 * (non-critical) type. Never throws — a failed notification should never
 * break the action that triggered it, same reasoning as recordAudit.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { notificationPrefs: true, isActive: true } });
    if (!user || !user.isActive) return;
    if (isOptedOut(user.notificationPrefs, input.type)) return;

    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      },
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

/**
 * Notifies every active user who holds a given permission — e.g. everyone
 * who can see buy requests, when a new one comes in. Bounded to users with
 * that specific permission, so this naturally respects RBAC: a salesman
 * without buyRequests.view is never notified about buy requests, an admin
 * without a sales-related role never gets sales noise, etc.
 */
export async function notifyUsersWithPermission(
  permission: Permission,
  input: Omit<NotifyInput, "userId">,
  excludeUserId?: string
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, id: excludeUserId ? { not: excludeUserId } : undefined },
      select: { id: true, role: true, permissions: true, notificationPrefs: true },
    });
    const recipients = users.filter(
      (u) => hasPermission({ role: u.role, permissions: u.permissions as any }, permission) && !isOptedOut(u.notificationPrefs, input.type)
    );
    if (recipients.length === 0) return;

    await prisma.notification.createMany({
      data: recipients.map((u) => ({
        userId: u.id,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      })),
    });
  } catch (err) {
    console.error("Failed to create notifications:", err);
  }
}
