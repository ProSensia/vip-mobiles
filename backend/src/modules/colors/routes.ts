import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS } from "../../shared";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const colors = await prisma.color.findMany({ orderBy: { name: "asc" } });
    res.json({ colors });
  })
);

const colorSchema = z.object({
  name: z.string().min(1).max(60),
  hexCode: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/),
});

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_MANAGE_COLORS),
  validateBody(colorSchema),
  asyncHandler(async (req, res) => {
    const color = await prisma.color.create({ data: req.body });
    await recordAudit(req, { action: "color.created", entityType: "Color", entityId: color.id });
    res.status(201).json({ color });
  })
);

router.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_MANAGE_COLORS),
  validateBody(colorSchema.partial()),
  asyncHandler(async (req, res) => {
    const color = await prisma.color.update({ where: { id: req.params.id }, data: req.body });
    await recordAudit(req, { action: "color.updated", entityType: "Color", entityId: color.id });
    res.json({ color });
  })
);

router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_MANAGE_COLORS),
  asyncHandler(async (req, res) => {
    const usage = await prisma.productVariant.count({ where: { colorId: req.params.id } });
    if (usage > 0) throw new ApiError(400, "Cannot delete a color still used by product variants.");
    await prisma.color.delete({ where: { id: req.params.id } });
    await recordAudit(req, { action: "color.deleted", entityType: "Color", entityId: req.params.id });
    res.json({ ok: true });
  })
);

export default router;
