"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUser = notifyUser;
exports.notifyUsersWithPermission = notifyUsersWithPermission;
const prisma_1 = require("../lib/prisma");
const shared_1 = require("../shared");
// Types a user can opt out of via User.notificationPrefs. Anything not in
// this list (referrals landing directly on you, system notices) is always
// created — matches "critical notifications should not be disabled".
const OPTIONAL_TYPES = new Set([
    "BUY_REQUEST_NEW",
    "SALE_COMPLETED",
    "LOW_STOCK",
    "REVIEW_SUBMITTED",
]);
function isOptedOut(prefs, type) {
    if (!OPTIONAL_TYPES.has(type))
        return false;
    if (!prefs || typeof prefs !== "object")
        return false;
    const value = prefs[type];
    return value === false;
}
/**
 * Creates a single notification, unless the recipient has opted out of this
 * (non-critical) type. Never throws — a failed notification should never
 * break the action that triggered it, same reasoning as recordAudit.
 */
async function notifyUser(input) {
    try {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: input.userId }, select: { notificationPrefs: true, isActive: true } });
        if (!user || !user.isActive)
            return;
        if (isOptedOut(user.notificationPrefs, input.type))
            return;
        await prisma_1.prisma.notification.create({
            data: {
                userId: input.userId,
                type: input.type,
                title: input.title,
                message: input.message,
                link: input.link,
            },
        });
    }
    catch (err) {
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
async function notifyUsersWithPermission(permission, input, excludeUserId) {
    try {
        const users = await prisma_1.prisma.user.findMany({
            where: { isActive: true, id: excludeUserId ? { not: excludeUserId } : undefined },
            select: { id: true, role: true, permissions: true, notificationPrefs: true },
        });
        const recipients = users.filter((u) => (0, shared_1.hasPermission)({ role: u.role, permissions: u.permissions }, permission) && !isOptedOut(u.notificationPrefs, input.type));
        if (recipients.length === 0)
            return;
        await prisma_1.prisma.notification.createMany({
            data: recipients.map((u) => ({
                userId: u.id,
                type: input.type,
                title: input.title,
                message: input.message,
                link: input.link,
            })),
        });
    }
    catch (err) {
        console.error("Failed to create notifications:", err);
    }
}
