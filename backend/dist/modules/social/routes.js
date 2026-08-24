"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
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
const generateSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1),
    imageId: zod_1.z.string().optional(), // pick a specific product photo as the hero shot; defaults to primary
    platform: zod_1.z.enum(["INSTAGRAM", "TIKTOK"]),
    format: zod_1.z.enum(["square", "portrait", "story"]).optional(),
    template: zod_1.z.enum(["classic", "bold"]).optional(),
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
router.post("/generate", (0, validate_1.validateBody)(generateSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const product = await prisma_1.prisma.product.findUnique({
        where: { id: body.productId },
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
    const chosenImage = body.imageId ? product.images.find((i) => i.id === body.imageId) : undefined;
    const primary = chosenImage ?? product.images.find((i) => i.isPrimary) ?? product.images[0];
    const supporting = product.images.filter((i) => i.id !== primary.id).map((i) => i.webpUrl || i.url);
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
    const stockLine = stockLevel === "LOW_STOCK"
        ? "⚠ Only a few left in stock"
        : stockLevel === "OUT_OF_STOCK"
            ? null
            : "✓ In Stock";
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
        template: body.template,
        gradientId: body.gradientId,
        format: body.format,
        showLogo: body.showLogo,
        showPrice: body.showPrice,
        showDescription: body.showDescription,
        showCTA: body.showCTA,
        showSupportingImages: body.showSupportingImages,
        showBadges: body.showBadges,
        ctaText: body.ctaText,
        description: body.description,
    };
    const heroImageUrl = primary.webpUrl || primary.url;
    const isStory = body.platform === "TIKTOK" || body.format === "story";
    const buffer = config.template === "bold" && !isStory
        ? await (0, render_1.renderBoldCreative)(productInput, heroImageUrl, config)
        : isStory
            ? await (0, render_1.renderStoryCreative)(productInput, heroImageUrl, config)
            : await (0, render_1.renderInstagramCreative)(productInput, heroImageUrl, supporting, config);
    const filename = `social/${product.id}/${(0, nanoid_1.nanoid)(10)}.png`;
    const imageUrl = await storage_1.storage.save(filename, buffer);
    const creative = await prisma_1.prisma.socialCreative.create({
        data: {
            productId: product.id,
            platform: body.platform,
            config: config,
            imageUrl,
            createdById: req.user.id,
        },
    });
    (0, audit_1.recordAudit)(req, {
        action: "social.creative.generated",
        entityType: "SocialCreative",
        entityId: creative.id,
        meta: { platform: body.platform, productId: product.id },
    });
    res.status(201).json({ creative });
}));
router.get("/history/:productId", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const creatives = await prisma_1.prisma.socialCreative.findMany({
        where: { productId: req.params.productId },
        orderBy: { createdAt: "desc" },
        take: 30,
    });
    res.json({ creatives });
}));
exports.default = router;
