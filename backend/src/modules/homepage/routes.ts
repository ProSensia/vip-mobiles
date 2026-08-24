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
    const includeHidden = req.query.all === "1" && !!req.user;
    const sections = await prisma.homepageSection.findMany({
      where: includeHidden ? undefined : { isVisible: true },
      orderBy: { sortOrder: "asc" },
    });
    res.json({ sections });
  })
);

const sectionSchema = z.object({
  type: z.enum([
    "FEATURED_PRODUCTS",
    "NEW_ARRIVALS",
    "FEATURED_CATEGORIES",
    "SELECTED_PRODUCTS",
    "BANNER",
    "BRANCHES",
    "CUSTOM_HTML",
  ]),
  title: z.string().max(200).optional().nullable(),
  subtitle: z.string().max(300).optional().nullable(),
  config: z.record(z.any()).optional().nullable(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.CONTENT_HOMEPAGE),
  validateBody(sectionSchema),
  asyncHandler(async (req, res) => {
    const count = await prisma.homepageSection.count();
    const section = await prisma.homepageSection.create({
      data: { ...req.body, sortOrder: req.body.sortOrder ?? count },
    });
    recordAudit(req, { action: "homepage.section.created", entityType: "HomepageSection", entityId: section.id });
    res.status(201).json({ section });
  })
);

router.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CONTENT_HOMEPAGE),
  validateBody(sectionSchema.partial()),
  asyncHandler(async (req, res) => {
    const section = await prisma.homepageSection.update({ where: { id: req.params.id }, data: req.body });
    recordAudit(req, { action: "homepage.section.updated", entityType: "HomepageSection", entityId: section.id });
    res.json({ section });
  })
);

const reorderSchema = z.object({ order: z.array(z.string()).min(1) });

router.patch(
  "/reorder",
  authenticate,
  requirePermission(PERMISSIONS.CONTENT_HOMEPAGE),
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    await prisma.$transaction(
      req.body.order.map((id: string, index: number) =>
        prisma.homepageSection.update({ where: { id }, data: { sortOrder: index } })
      )
    );
    res.json({ ok: true });
  })
);

router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CONTENT_HOMEPAGE),
  asyncHandler(async (req, res) => {
    await prisma.homepageSection.delete({ where: { id: req.params.id } });
    recordAudit(req, { action: "homepage.section.deleted", entityType: "HomepageSection", entityId: req.params.id });
    res.json({ ok: true });
  })
);

export default router;
