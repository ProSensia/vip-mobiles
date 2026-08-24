"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const sharp_1 = __importDefault(require("sharp"));
const nanoid_1 = require("nanoid");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const storage_1 = require("../../lib/storage");
const audit_1 = require("../../utils/audit");
const env_1 = require("../../env");
const shared_1 = require("../../shared");
const render_1 = require("./render");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.SOCIAL_GENERATE));
router.get("/gradients", (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    res.json({ gradients: shared_1.SOCIAL_GRADIENTS });
}));
const generateOptionsSchema = zod_1.z.object({
    imageId: zod_1.z.string().optional(), // pick a specific product photo as the hero shot; defaults to primary
    platform: zod_1.z.enum(["INSTAGRAM", "TIKTOK"]),
    format: zod_1.z.enum(["square", "portrait", "story"]).optional(),
    template: zod_1.z.enum(["classic", "bold", "collage"]).optional(),
    gradientId: zod_1.z.string().optional(),
    showLogo: zod_1.z.boolean().optional(),
    showPrice: zod_1.z.boolean().optional(),
    showDescription: zod_1.z.boolean().optional(),
    showCTA: zod_1.z.boolean().optional(),
    showSupportingImages: zod_1.z.boolean().optional(),
    showBadges: zod_1.z.boolean().optional(),
    ctaText: zod_1.z.string().max(60).optional(),
    description: zod_1.z.string().max(200).optional(),
});
/**
 * Shared by /generate (fresh options from the form) and /:id/regenerate
 * (options replayed from a past creative's stored config) — both need the
 * exact same "look up the product, compute current badges/pricing, render,
 * save a thumbnail, persist the row" sequence, so it lives in one place
 * rather than being duplicated between the two routes.
 */
async function generateCreative(productId, opts, createdById) {
    const product = await prisma_1.prisma.product.findUnique({
        where: { id: productId },
        include: {
            images: { orderBy: { sortOrder: "asc" } },
            variants: { select: { stockQty: true } },
        },
    });
    if (!product)
        throw new errorHandler_1.ApiError(404, "Product not found");
    if (product.images.length === 0)
        throw new errorHandler_1.ApiError(400, "This product has no images to generate a creative from");
    const settingRows = await prisma_1.prisma.setting.findMany({ where: { key: { in: ["currency", "whatsappNumber"] } } });
    const settingsMap = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
    const currency = settingsMap.currency || "PKR";
    const whatsappNumber = settingsMap.whatsappNumber || null;
    const chosenImage = opts.imageId ? product.images.find((i) => i.id === opts.imageId) : undefined;
    const primary = chosenImage ?? product.images.find((i) => i.isPrimary) ?? product.images[0];
    const supporting = product.images.filter((i) => i.id !== primary.id).map((i) => i.webpUrl || i.url);
    // Badges/pricing/stock are always recomputed from the product's current
    // state (not cached from whenever the original was generated) — a
    // regenerate is explicitly meant to pick up any changes since then.
    const badgeableProduct = { ...product, basePrice: Number(product.basePrice), compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null };
    const discountPercent = (0, shared_1.computeDiscountPercent)(badgeableProduct);
    const stockLevel = (0, shared_1.computeStockLevel)(badgeableProduct);
    const badges = [];
    if (discountPercent)
        badges.push({ text: `-${discountPercent}%`, tone: "discount" });
    if (product.isTrending)
        badges.push({ text: "HOT DEAL", tone: "hot" });
    else if (product.isNewArrival)
        badges.push({ text: "NEW ARRIVAL", tone: "new" });
    if (product.isBestSeller)
        badges.push({ text: "BEST SELLER", tone: "best" });
    if (stockLevel === "LOW_STOCK")
        badges.push({ text: "LIMITED STOCK", tone: "stock" });
    if (product.isPtaApproved)
        badges.push({ text: "PTA APPROVED", tone: "trust" });
    const stockLine = stockLevel === "LOW_STOCK" ? "⚠ Only a few left in stock" : stockLevel === "OUT_OF_STOCK" ? null : "✓ In Stock";
    const productInput = {
        title: product.title,
        price: (0, render_1.formatCreativePrice)(Number(product.basePrice), currency),
        compareAtPrice: discountPercent && product.compareAtPrice ? (0, render_1.formatCreativePrice)(Number(product.compareAtPrice), currency) : null,
        description: product.description,
        stockLine,
        badges: badges.slice(0, 3),
        websiteUrl: env_1.env.WEB_APP_URL.replace(/^https?:\/\//, ""),
        whatsappNumber,
    };
    const config = {
        template: opts.template,
        gradientId: opts.gradientId,
        format: opts.format,
        showLogo: opts.showLogo,
        showPrice: opts.showPrice,
        showDescription: opts.showDescription,
        showCTA: opts.showCTA,
        showSupportingImages: opts.showSupportingImages,
        showBadges: opts.showBadges,
        ctaText: opts.ctaText,
        description: opts.description,
    };
    const heroImageUrl = primary.webpUrl || primary.url;
    const isStory = opts.platform === "TIKTOK" || opts.format === "story";
    const buffer = isStory
        ? await (0, render_1.renderStoryCreative)(productInput, heroImageUrl, config)
        : config.template === "bold"
            ? await (0, render_1.renderBoldCreative)(productInput, heroImageUrl, config)
            : config.template === "collage"
                ? await (0, render_1.renderCollageCreative)(productInput, heroImageUrl, supporting, config)
                : await (0, render_1.renderInstagramCreative)(productInput, heroImageUrl, supporting, config);
    const id = (0, nanoid_1.nanoid)(10);
    const [imageUrl, thumbUrl] = await Promise.all([
        storage_1.storage.save(`social/${product.id}/${id}.png`, buffer),
        // A small WebP thumbnail so the Post History gallery never has to load
        // full-resolution generated PNGs (which can be 1080x1920) just to show
        // a preview tile.
        (0, sharp_1.default)(buffer)
            .resize({ width: 320 })
            .webp({ quality: 78 })
            .toBuffer()
            .then((thumb) => storage_1.storage.save(`social/${product.id}/${id}-thumb.webp`, thumb)),
    ]);
    const creative = await prisma_1.prisma.socialCreative.create({
        data: { productId: product.id, platform: opts.platform, config: config, imageUrl, thumbUrl, createdById },
    });
    return creative;
}
router.post("/generate", (0, validate_1.validateBody)(generateOptionsSchema.extend({ productId: zod_1.z.string().min(1) })), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { productId, ...opts } = req.body;
    const creative = await generateCreative(productId, opts, req.user.id);
    (0, audit_1.recordAudit)(req, {
        action: "social.creative.generated",
        entityType: "SocialCreative",
        entityId: creative.id,
        meta: { platform: creative.platform, productId },
    });
    res.status(201).json({ creative });
}));
router.post("/creatives/:id/regenerate", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const existing = await prisma_1.prisma.socialCreative.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt)
        throw new errorHandler_1.ApiError(404, "Creative not found");
    const opts = { platform: existing.platform, ...existing.config };
    const creative = await generateCreative(existing.productId, opts, req.user.id);
    (0, audit_1.recordAudit)(req, {
        action: "social.creative.regenerated",
        entityType: "SocialCreative",
        entityId: creative.id,
        meta: { sourceId: existing.id, productId: existing.productId },
    });
    res.status(201).json({ creative });
}));
// Global Post History — every generated creative across every product, not
// just one. Thumbnails only, paginated, so opening this page never pulls
// down a wall of full-resolution images.
const listCreativesSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(48).default(24),
});
router.get("/creatives", (0, validate_1.validateQuery)(listCreativesSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const q = req.query;
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
        prisma_1.prisma.socialCreative.findMany({
            where,
            include: {
                product: { select: { id: true, title: true, slug: true } },
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (q.page - 1) * q.limit,
            take: q.limit,
        }),
        prisma_1.prisma.socialCreative.count({ where }),
    ]);
    res.json({ items, total, page: q.page, totalPages: Math.ceil(total / q.limit) });
}));
router.delete("/creatives/:id", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const creative = await prisma_1.prisma.socialCreative.findUnique({ where: { id: req.params.id } });
    if (!creative || creative.deletedAt)
        throw new errorHandler_1.ApiError(404, "Creative not found");
    // Soft-delete keeps the row (and the audit trail below) for history;
    // the actual image files are removed since nothing needs them anymore.
    await prisma_1.prisma.socialCreative.update({ where: { id: creative.id }, data: { deletedAt: new Date() } });
    await Promise.all([
        storage_1.storage.delete(creative.imageUrl).catch(() => { }),
        creative.thumbUrl ? storage_1.storage.delete(creative.thumbUrl).catch(() => { }) : Promise.resolve(),
    ]);
    (0, audit_1.recordAudit)(req, { action: "social.creative.deleted", entityType: "SocialCreative", entityId: creative.id });
    res.json({ ok: true });
}));
router.get("/history/:productId", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const creatives = await prisma_1.prisma.socialCreative.findMany({
        where: { productId: req.params.productId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 30,
    });
    res.json({ creatives });
}));
exports.default = router;
