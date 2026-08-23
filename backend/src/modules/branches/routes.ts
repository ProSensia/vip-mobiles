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
    const branches = await prisma.branch.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        staffProfiles: {
          where: { displayOnSite: true },
          include: { user: { select: { name: true, avatarUrl: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    res.json({ branches });
  })
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const branch = await prisma.branch.findUnique({
      where: { slug: req.params.slug },
      include: {
        staffProfiles: {
          where: { displayOnSite: true },
          include: { user: { select: { name: true, avatarUrl: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!branch) throw new ApiError(404, "Branch not found");
    res.json({ branch });
  })
);

const branchSchema = z.object({
  name: z.string().min(1).max(150),
  address: z.string().min(1).max(300),
  city: z.string().min(1).max(120),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  mapUrl: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  openingHours: z.record(z.string()).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(320).optional().nullable(),
});

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.BRANCHES_MANAGE),
  validateBody(branchSchema),
  asyncHandler(async (req, res) => {
    const slug = slugify(req.body.name);
    const branch = await prisma.branch.create({ data: { ...req.body, slug } as any });
    await recordAudit(req, { action: "branch.created", entityType: "Branch", entityId: branch.id });
    res.status(201).json({ branch });
  })
);

router.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.BRANCHES_MANAGE),
  validateBody(branchSchema.partial()),
  asyncHandler(async (req, res) => {
    const data: any = { ...req.body };
    if (req.body.name) data.slug = slugify(req.body.name);
    const branch = await prisma.branch.update({ where: { id: req.params.id }, data });
    await recordAudit(req, { action: "branch.updated", entityType: "Branch", entityId: branch.id });
    res.json({ branch });
  })
);

router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.BRANCHES_MANAGE),
  asyncHandler(async (req, res) => {
    const count = await prisma.product.count({ where: { branchId: req.params.id } });
    if (count > 0) throw new ApiError(400, "Cannot delete a branch that still has products assigned.");
    await prisma.branch.delete({ where: { id: req.params.id } });
    await recordAudit(req, { action: "branch.deleted", entityType: "Branch", entityId: req.params.id });
    res.json({ ok: true });
  })
);

export default router;
