"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
const uniqueSlug_1 = require("../../utils/uniqueSlug");
const shared_1 = require("../../shared");
const variants_routes_1 = __importDefault(require("./variants.routes"));
const images_routes_1 = __importDefault(require("./images.routes"));
const videos_routes_1 = __importDefault(require("./videos.routes"));
const reviews_routes_1 = __importDefault(require("./reviews.routes"));
const router = (0, express_1.Router)();
// GET routes below vary their response (which statuses are visible) based on
// whether the caller is authenticated staff — populate req.user when a valid
// session cookie is present, but never require one.
router.use(auth_1.authenticateOptional);
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
};
const listQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(60).default(24),
    category: zod_1.z.string().optional(),
    brand: zod_1.z.string().optional(),
    condition: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    q: zod_1.z.string().optional(),
    minPrice: zod_1.z.coerce.number().optional(),
    maxPrice: zod_1.z.coerce.number().optional(),
    sort: zod_1.z.enum(["newest", "price_asc", "price_desc", "featured"]).default("newest"),
});
router.get("/", (0, validate_1.validateQuery)(listQuerySchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const q = req.query;
    const where = {};
    if (!req.user) {
        // Public catalog: never exposes HIDDEN products, regardless of what a caller requests.
        const publicStatuses = ["AVAILABLE", "RESERVED", "SOLD"];
        where.status = q.status && publicStatuses.includes(q.status) ? q.status : { in: ["AVAILABLE", "RESERVED"] };
    }
    else if (q.status) {
        where.status = q.status;
    }
    // Authenticated staff with no explicit status filter see every status, including HIDDEN.
    if (q.category)
        where.category = { slug: q.category };
    if (q.brand)
        where.brand = { slug: q.brand };
    if (q.condition)
        where.condition = q.condition;
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
    const orderBy = q.sort === "price_asc"
        ? [{ basePrice: "asc" }]
        : q.sort === "price_desc"
            ? [{ basePrice: "desc" }]
            : q.sort === "featured"
                ? [{ isFeatured: "desc" }, { createdAt: "desc" }]
                : [{ createdAt: "desc" }];
    const [items, total] = await Promise.all([
        prisma_1.prisma.product.findMany({
            where,
            select: PUBLIC_CARD_SELECT,
            orderBy,
            skip: (q.page - 1) * q.limit,
            take: q.limit,
        }),
        prisma_1.prisma.product.count({ where }),
    ]);
    res.json({ items, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) });
}));
router.get("/featured", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 9, 12);
    const items = await prisma_1.prisma.product.findMany({
        where: { isFeatured: true, status: { in: ["AVAILABLE", "RESERVED"] } },
        select: PUBLIC_CARD_SELECT,
        orderBy: { createdAt: "desc" },
        take: limit,
    });
    res.json({ items });
}));
router.get("/new-arrivals", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 9, 12);
    const items = await prisma_1.prisma.product.findMany({
        where: { isNewArrival: true, status: { in: ["AVAILABLE", "RESERVED"] } },
        select: PUBLIC_CARD_SELECT,
        orderBy: { createdAt: "desc" },
        take: limit,
    });
    res.json({ items });
}));
// Admin edit screens navigate by id (not slug); kept above the /:slug route
// so Express doesn't swallow it as a slug lookup.
router.get("/by-id/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_VIEW), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const product = await prisma_1.prisma.product.findUnique({
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
    if (!product)
        throw new errorHandler_1.ApiError(404, "Product not found");
    res.json({ product });
}));
router.get("/:slug", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const product = await prisma_1.prisma.product.findUnique({
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
    if (!product)
        throw new errorHandler_1.ApiError(404, "Product not found");
    if (product.status === "HIDDEN" && !req.user)
        throw new errorHandler_1.ApiError(404, "Product not found");
    prisma_1.prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => { });
    const related = await prisma_1.prisma.product.findMany({
        where: {
            id: { not: product.id },
            categoryId: product.categoryId,
            status: { in: ["AVAILABLE", "RESERVED"] },
        },
        select: PUBLIC_CARD_SELECT,
        take: 8,
    });
    res.json({ product, related });
}));
const specSchema = zod_1.z.array(zod_1.z.object({ label: zod_1.z.string().min(1), value: zod_1.z.string().min(1) }));
const productSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(200),
    brandId: zod_1.z.string().min(1),
    categoryId: zod_1.z.string().min(1),
    branchId: zod_1.z.string().optional().nullable(),
    sku: zod_1.z.string().optional().nullable(),
    condition: zod_1.z.enum(["NEW", "USED", "REFURBISHED", "OPEN_BOX"]),
    description: zod_1.z.string().optional().nullable(),
    specifications: specSchema.optional().nullable(),
    basePrice: zod_1.z.coerce.number().positive(),
    compareAtPrice: zod_1.z.coerce.number().positive().optional().nullable(),
    boxAvailable: zod_1.z.boolean().optional(),
    isFeatured: zod_1.z.boolean().optional(),
    isNewArrival: zod_1.z.boolean().optional(),
    metaTitle: zod_1.z.string().max(200).optional().nullable(),
    metaDescription: zod_1.z.string().max(320).optional().nullable(),
});
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_CREATE), (0, validate_1.validateBody)(productSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const slug = await (0, uniqueSlug_1.uniqueProductSlug)(req.body.title);
    const product = await prisma_1.prisma.product.create({
        data: { ...req.body, slug, createdById: req.user.id },
    });
    await (0, audit_1.recordAudit)(req, { action: "product.created", entityType: "Product", entityId: product.id });
    res.status(201).json({ product });
}));
router.patch("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_EDIT), (0, validate_1.validateBody)(productSchema.partial()), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const data = { ...req.body };
    if (req.body.title)
        data.slug = await (0, uniqueSlug_1.uniqueProductSlug)(req.body.title, req.params.id);
    const product = await prisma_1.prisma.product.update({ where: { id: req.params.id }, data });
    await (0, audit_1.recordAudit)(req, { action: "product.updated", entityType: "Product", entityId: product.id });
    res.json({ product });
}));
const statusSchema = zod_1.z.object({
    status: zod_1.z.enum(["AVAILABLE", "RESERVED", "SOLD", "HIDDEN"]),
    soldPrice: zod_1.z.coerce.number().positive().optional(),
});
router.patch("/:id/status", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_MANAGE_STOCK), (0, validate_1.validateBody)(statusSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const data = { status: req.body.status };
    if (req.body.status === "SOLD") {
        data.soldAt = new Date();
        data.isFeatured = false;
        if (req.body.soldPrice)
            data.soldPrice = req.body.soldPrice;
    }
    else {
        data.soldAt = null;
        data.soldPrice = null;
    }
    const product = await prisma_1.prisma.product.update({ where: { id: req.params.id }, data });
    await (0, audit_1.recordAudit)(req, {
        action: "product.status.changed",
        entityType: "Product",
        entityId: product.id,
        meta: { status: req.body.status },
    });
    res.json({ product });
}));
router.delete("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_DELETE), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const sale = await prisma_1.prisma.sale.findUnique({ where: { productId: req.params.id } });
    if (sale)
        throw new errorHandler_1.ApiError(400, "Cannot delete a product with sale history. Hide it instead to preserve records.");
    await prisma_1.prisma.product.delete({ where: { id: req.params.id } });
    await (0, audit_1.recordAudit)(req, { action: "product.deleted", entityType: "Product", entityId: req.params.id });
    res.json({ ok: true });
}));
router.use("/:id/variants", variants_routes_1.default);
router.use("/:id/images", images_routes_1.default);
router.use("/:id/videos", videos_routes_1.default);
router.use("/:id/reviews", reviews_routes_1.default);
exports.default = router;
