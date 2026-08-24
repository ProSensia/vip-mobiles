import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS, slugify } from "../../shared";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === "1";
    const brands = await prisma.brand.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    res.json({ brands });
  })
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const brand = await prisma.brand.findUnique({ where: { slug: req.params.slug } });
    if (!brand) throw new ApiError(404, "Brand not found");
    res.json({ brand });
  })
);

const brandSchema = z.object({
  name: z.string().min(1).max(120),
  logoUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(320).optional().nullable(),
});

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_MANAGE_BRANDS),
  validateBody(brandSchema),
  asyncHandler(async (req, res) => {
    const slug = slugify(req.body.name);
    const brand = await prisma.brand.create({ data: { ...req.body, slug } });
    recordAudit(req, { action: "brand.created", entityType: "Brand", entityId: brand.id });
    res.status(201).json({ brand });
  })
);

router.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_MANAGE_BRANDS),
  validateBody(brandSchema.partial()),
  asyncHandler(async (req, res) => {
    const data: any = { ...req.body };
    if (req.body.name) data.slug = slugify(req.body.name);
    const brand = await prisma.brand.update({ where: { id: req.params.id }, data });
    recordAudit(req, { action: "brand.updated", entityType: "Brand", entityId: brand.id });
    res.json({ brand });
  })
);

router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CATALOG_MANAGE_BRANDS),
  asyncHandler(async (req, res) => {
    const count = await prisma.product.count({ where: { brandId: req.params.id } });
    if (count > 0) throw new ApiError(400, "Cannot delete a brand that still has products. Reassign or remove them first.");
    await prisma.brand.delete({ where: { id: req.params.id } });
    recordAudit(req, { action: "brand.deleted", entityType: "Brand", entityId: req.params.id });
    res.json({ ok: true });
  })
);

export default router;
