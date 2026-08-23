"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const auth_1 = require("../../middleware/auth");
const shared_1 = require("../../shared");
const router = (0, express_1.Router)();
const querySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    entityType: zod_1.z.string().optional(),
    userId: zod_1.z.string().optional(),
});
router.get("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.AUDIT_VIEW), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const q = querySchema.parse(req.query);
    const where = {
        ...(q.entityType ? { entityType: q.entityType } : {}),
        ...(q.userId ? { userId: q.userId } : {}),
    };
    const [items, total] = await Promise.all([
        prisma_1.prisma.auditLog.findMany({
            where,
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "desc" },
            skip: (q.page - 1) * q.limit,
            take: q.limit,
        }),
        prisma_1.prisma.auditLog.count({ where }),
    ]);
    res.json({ items, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) });
}));
exports.default = router;
