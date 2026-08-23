import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate, requirePermission } from "../../middleware/auth";
import { PERMISSIONS } from "../../shared";

const router = Router();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  entityType: z.string().optional(),
  userId: z.string().optional(),
});

router.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  asyncHandler(async (req, res) => {
    const q = querySchema.parse(req.query);
    const where = {
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ items, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) });
  })
);

export default router;
