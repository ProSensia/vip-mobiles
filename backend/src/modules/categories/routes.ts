import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS, slugify } from "@vip/shared";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === "1";
    const featuredOnly = req.query.featured === "1";
    const categories = await prisma.category.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(featuredOnly ? { isFeatured: true } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    res.json({ categories });
  })
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({ where: { slug: req.params.slug } });
    if (!category) throw new ApiError(404, "Category not found");
    res.json({ category });
  })
);

const categorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(320).optional().nullable(),
});

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_MANAGE_CATEGORIES),
  validateBody(categorySchema),
  asyncHandler(async (req, res) => {
    const slug = slugify(req.body.name);
    const category = await prisma.category.create({ data: { ...req.body, slug } });
    await recordAudit(req, { action: "category.created", entityType: "Category", entityId: category.id });
    res.status(201).json({ category });
  })
);

router.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_MANAGE_CATEGORIES),
  validateBody(categorySchema.partial()),
  asyncHandler(async (req, res) => {
    const data: any = { ...req.body };
    if (req.body.name) data.slug = slugify(req.body.name);
    const category = await prisma.category.update({ where: { id: req.params.id }, data });
    await recordAudit(req, { action: "category.updated", entityType: "Category", entityId: category.id });
    res.json({ category });
  })
);

router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_MANAGE_CATEGORIES),
  asyncHandler(async (req, res) => {
    const count = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (count > 0) throw new ApiError(400, "Cannot delete a category that still has products. Reassign or remove them first.");
    await prisma.category.delete({ where: { id: req.params.id } });
    await recordAudit(req, { action: "category.deleted", entityType: "Category", entityId: req.params.id });
    res.json({ ok: true });
  })
);

export default router;
