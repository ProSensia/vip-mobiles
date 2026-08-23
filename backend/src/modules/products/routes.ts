import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody, validateQuery } from "../../middleware/validate";
import { authenticate, authenticateOptional, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { uniqueProductSlug } from "../../utils/uniqueSlug";
import { PERMISSIONS } from "../../shared";
import variantsRouter from "./variants.routes";
import imagesRouter from "./images.routes";
import videosRouter from "./videos.routes";
import reviewsRouter from "./reviews.routes";

const router = Router();

// GET routes below vary their response (which statuses are visible) based on
// whether the caller is authenticated staff — populate req.user when a valid
// session cookie is present, but never require one.
router.use(authenticateOptional);

const PUBLIC_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  condition: true,
  status: true,
  basePrice: true,
  compareAtPrice: true,
  boxAvailable: true,
  isFeatured: true,
  isNewArrival: true,
  createdAt: true,
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  images: { where: { isPrimary: true }, take: 1 },
} satisfies Prisma.ProductSelect;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  category: z.string().optional(),
  brand: z.string().optional(),
  condition: z.string().optional(),
  status: z.string().optional(),
  q: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "featured"]).default("newest"),
});

router.get(
  "/",
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;

    const where: Prisma.ProductWhereInput = {};
    if (!req.user) {
      // Public catalog: never exposes HIDDEN products, regardless of what a caller requests.
      const publicStatuses = ["AVAILABLE", "RESERVED", "SOLD"];
      where.status = q.status && publicStatuses.includes(q.status) ? (q.status as any) : { in: ["AVAILABLE", "RESERVED"] };
    } else if (q.status) {
      where.status = q.status as any;
    }
    // Authenticated staff with no explicit status filter see every status, including HIDDEN.

    if (q.category) where.category = { slug: q.category };
    if (q.brand) where.brand = { slug: q.brand };
    if (q.condition) where.condition = q.condition as any;
    if (q.q) {
      where.OR = [
        { title: { contains: q.q } },
        { description: { contains: q.q } },
      ];
    }
    if (q.minPrice || q.maxPrice) {
      where.basePrice = {
        ...(q.minPrice ? { gte: q.minPrice } : {}),
        ...(q.maxPrice ? { lte: q.maxPrice } : {}),
      };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      q.sort === "price_asc"
        ? [{ basePrice: "asc" }]
        : q.sort === "price_desc"
        ? [{ basePrice: "desc" }]
        : q.sort === "featured"
        ? [{ isFeatured: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: PUBLIC_CARD_SELECT,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ items, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) });
  })
);

router.get(
  "/featured",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 9, 12);
    const items = await prisma.product.findMany({
      where: { isFeatured: true, status: { in: ["AVAILABLE", "RESERVED"] } },
      select: PUBLIC_CARD_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ items });
  })
);

router.get(
  "/new-arrivals",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 9, 12);
    const items = await prisma.product.findMany({
      where: { isNewArrival: true, status: { in: ["AVAILABLE", "RESERVED"] } },
      select: PUBLIC_CARD_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({ items });
  })
);

// Admin edit screens navigate by id (not slug); kept above the /:slug route
// so Express doesn't swallow it as a slug lookup.
router.get(
  "/by-id/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        brand: true,
        category: true,
        branch: true,
        variants: { include: { color: true }, orderBy: { createdAt: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
        reviews: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!product) throw new ApiError(404, "Product not found");
    res.json({ product });
  })
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: {
        brand: true,
        category: true,
        branch: true,
        variants: { include: { color: true }, orderBy: { createdAt: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
        reviews: { where: { isApproved: true }, orderBy: { createdAt: "desc" } },
      },
    });

    if (!product) throw new ApiError(404, "Product not found");
    if (product.status === "HIDDEN" && !req.user) throw new ApiError(404, "Product not found");

    prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

    const related = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        categoryId: product.categoryId,
        status: { in: ["AVAILABLE", "RESERVED"] },
      },
      select: PUBLIC_CARD_SELECT,
      take: 8,
    });

    res.json({ product, related });
  })
);

const specSchema = z.array(z.object({ label: z.string().min(1), value: z.string().min(1) }));

const productSchema = z.object({
  title: z.string().min(2).max(200),
  brandId: z.string().min(1),
  categoryId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  condition: z.enum(["NEW", "USED", "REFURBISHED", "OPEN_BOX"]),
  description: z.string().optional().nullable(),
  specifications: specSchema.optional().nullable(),
  basePrice: z.coerce.number().positive(),
  compareAtPrice: z.coerce.number().positive().optional().nullable(),
  boxAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(320).optional().nullable(),
});

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  validateBody(productSchema),
  asyncHandler(async (req, res) => {
    const slug = await uniqueProductSlug(req.body.title);
    const product = await prisma.product.create({
      data: { ...req.body, slug, createdById: req.user!.id },
    });
    await recordAudit(req, { action: "product.created", entityType: "Product", entityId: product.id });
    res.status(201).json({ product });
  })
);

router.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  validateBody(productSchema.partial()),
  asyncHandler(async (req, res) => {
    const data: any = { ...req.body };
    if (req.body.title) data.slug = await uniqueProductSlug(req.body.title, req.params.id);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    await recordAudit(req, { action: "product.updated", entityType: "Product", entityId: product.id });
    res.json({ product });
  })
);

const statusSchema = z.object({
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "HIDDEN"]),
  soldPrice: z.coerce.number().positive().optional(),
});

router.patch(
  "/:id/status",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE_STOCK),
  validateBody(statusSchema),
  asyncHandler(async (req, res) => {
    const data: any = { status: req.body.status };
    if (req.body.status === "SOLD") {
      data.soldAt = new Date();
      data.isFeatured = false;
      if (req.body.soldPrice) data.soldPrice = req.body.soldPrice;
    } else {
      data.soldAt = null;
      data.soldPrice = null;
    }
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    await recordAudit(req, {
      action: "product.status.changed",
      entityType: "Product",
      entityId: product.id,
      meta: { status: req.body.status },
    });
    res.json({ product });
  })
);

router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  asyncHandler(async (req, res) => {
    const sale = await prisma.sale.findUnique({ where: { productId: req.params.id } });
    if (sale) throw new ApiError(400, "Cannot delete a product with sale history. Hide it instead to preserve records.");
    await prisma.product.delete({ where: { id: req.params.id } });
    await recordAudit(req, { action: "product.deleted", entityType: "Product", entityId: req.params.id });
    res.json({ ok: true });
  })
);

router.use("/:id/variants", variantsRouter);
router.use("/:id/images", imagesRouter);
router.use("/:id/videos", videosRouter);
router.use("/:id/reviews", reviewsRouter);

export default router;
