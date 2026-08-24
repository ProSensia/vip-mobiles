"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Every route here is implicitly scoped to req.user!.id — there is no way
// to pass another user's id in, by design: this is a personal inbox, not a
// generally-queryable resource, so there's nothing to gate behind a
// permission beyond just being logged in.
const listSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(20),
});
router.get("/", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const q = listSchema.parse(req.query);
    const where = { userId: req.user.id };
    const [items, total] = await Promise.all([
        prisma_1.prisma.notification.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (q.page - 1) * q.limit,
            take: q.limit,
        }),
        prisma_1.prisma.notification.count({ where }),
    ]);
    res.json({ items, total, page: q.page, totalPages: Math.ceil(total / q.limit) });
}));
// Polled from the notification bell every ~60s — kept as cheap as possible
// (a single indexed count, no rows fetched) since this is the one endpoint
// that runs on a timer rather than on user action.
router.get("/unread-count", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const count = await prisma_1.prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
    res.json({ count });
}));
router.patch("/:id/read", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user.id },
        data: { isRead: true },
    });
    res.json({ ok: true });
}));
router.patch("/read-all", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.notification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true },
    });
    res.json({ ok: true });
}));
const prefsSchema = zod_1.z.object({ prefs: zod_1.z.record(zod_1.z.boolean()) });
router.put("/preferences", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const body = prefsSchema.parse(req.body);
    await prisma_1.prisma.user.update({ where: { id: req.user.id }, data: { notificationPrefs: body.prefs } });
    res.json({ ok: true });
}));
exports.default = router;
