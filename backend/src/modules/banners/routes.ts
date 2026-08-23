import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS } from "../../shared";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === "1" && !!req.user;
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(req.query.placement ? { placement: req.query.placement as any } : {}),
      },
      orderBy: { sortOrder: "asc" },
    });
    const visible = includeInactive
      ? banners
      : banners.filter((b) => (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt >= now));
    res.json({ banners: visible });
  })
);

const bannerSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  imageUrl: z.string().min(1),
  mobileImageUrl: z.string().optional().nullable(),
  link: z.string().max(300).optional().nullable(),
  placement: z.enum(["HOME_HERO", "HOME_STRIP", "CATALOG_TOP"]).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
});

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.CONTENT_BANNERS),
  validateBody(bannerSchema),
  asyncHandler(async (req, res) => {
    const banner = await prisma.banner.create({ data: req.body as any });
    await recordAudit(req, { action: "banner.created", entityType: "Banner", entityId: banner.id });
    res.status(201).json({ banner });
  })
);

router.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CONTENT_BANNERS),
  validateBody(bannerSchema.partial()),
  asyncHandler(async (req, res) => {
    const banner = await prisma.banner.update({ where: { id: req.params.id }, data: req.body as any });
    await recordAudit(req, { action: "banner.updated", entityType: "Banner", entityId: banner.id });
    res.json({ banner });
  })
);

router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CONTENT_BANNERS),
  asyncHandler(async (req, res) => {
    await prisma.banner.delete({ where: { id: req.params.id } });
    await recordAudit(req, { action: "banner.deleted", entityType: "Banner", entityId: req.params.id });
    res.json({ ok: true });
  })
);

export default router;
