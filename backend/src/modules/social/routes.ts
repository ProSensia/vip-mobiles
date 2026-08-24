import { Router } from "express";
import { z } from "zod";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody, validateQuery } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { storage } from "../../lib/storage";
import { recordAudit } from "../../utils/audit";
import { env } from "../../env";
import { PERMISSIONS, SOCIAL_GRADIENTS, computeDiscountPercent, computeStockLevel } from "../../shared";
import { renderInstagramCreative, renderStoryCreative, renderBoldCreative, renderCollageCreative, formatCreativePrice, type CreativeBadge, type CreativeConfig } from "./render";

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.SOCIAL_GENERATE));

router.get(
  "/gradients",
  asyncHandler(async (_req, res) => {
    res.json({ gradients: SOCIAL_GRADIENTS });
  })
);

const generateOptionsSchema = z.object({
  imageId: z.string().optional(), // pick a specific product photo as the hero shot; defaults to primary
  platform: z.enum(["INSTAGRAM", "TIKTOK"]),
  format: z.enum(["square", "portrait", "story"]).optional(),
  template: z.enum(["classic", "bold", "collage"]).optional(),
  gradientId: z.string().optional(),
  showLogo: z.boolean().optional(),
  showPrice: z.boolean().optional(),
  showDescription: z.boolean().optional(),
  showCTA: z.boolean().optional(),
  showSupportingImages: z.boolean().optional(),
  showBadges: z.boolean().optional(),
  ctaText: z.string().max(60).optional(),
  description: z.string().max(200).optional(),
});
type GenerateOptions = z.infer<typeof generateOptionsSchema>;

/**
 * Shared by /generate (fresh options from the form) and /:id/regenerate
 * (options replayed from a past creative's stored config) — both need the
 * exact same "look up the product, compute current badges/pricing, render,
 * save a thumbnail, persist the row" sequence, so it lives in one place
 * rather than being duplicated between the two routes.
 */
async function generateCreative(productId: string, opts: GenerateOptions, createdById: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { select: { stockQty: true } },
    },
  });
  if (!product) throw new ApiError(404, "Product not found");
  if (product.images.length === 0) throw new ApiError(400, "This product has no images to generate a creative from");

  const settingRows = await prisma.setting.findMany({ where: { key: { in: ["currency", "whatsappNumber"] } } });
  const settingsMap = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
  const currency = (settingsMap.currency as string) || "PKR";
  const whatsappNumber = (settingsMap.whatsappNumber as string) || null;

  const chosenImage = opts.imageId ? product.images.find((i) => i.id === opts.imageId) : undefined;
  const primary = chosenImage ?? product.images.find((i) => i.isPrimary) ?? product.images[0];
  const supporting = product.images.filter((i) => i.id !== primary.id).map((i) => i.webpUrl || i.url);

  // Badges/pricing/stock are always recomputed from the product's current
  // state (not cached from whenever the original was generated) — a
  // regenerate is explicitly meant to pick up any changes since then.
  const badgeableProduct = { ...product, basePrice: Number(product.basePrice), compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null };
  const discountPercent = computeDiscountPercent(badgeableProduct);
  const stockLevel = computeStockLevel(badgeableProduct);
  const badges: CreativeBadge[] = [];
  if (discountPercent) badges.push({ text: `-${discountPercent}%`, tone: "discount" });
  if (product.isTrending) badges.push({ text: "HOT DEAL", tone: "hot" });
  else if (product.isNewArrival) badges.push({ text: "NEW ARRIVAL", tone: "new" });
  if (product.isBestSeller) badges.push({ text: "BEST SELLER", tone: "best" });
  if (stockLevel === "LOW_STOCK") badges.push({ text: "LIMITED STOCK", tone: "stock" });
  if (product.isPtaApproved) badges.push({ text: "PTA APPROVED", tone: "trust" });

  const stockLine =
    stockLevel === "LOW_STOCK" ? "⚠ Only a few left in stock" : stockLevel === "OUT_OF_STOCK" ? null : "✓ In Stock";

  const productInput = {
    title: product.title,
    price: formatCreativePrice(Number(product.basePrice), currency),
    compareAtPrice: discountPercent && product.compareAtPrice ? formatCreativePrice(Number(product.compareAtPrice), currency) : null,
    description: product.description,
    stockLine,
    badges: badges.slice(0, 3),
    websiteUrl: env.WEB_APP_URL.replace(/^https?:\/\//, ""),
    whatsappNumber,
  };

  const config: CreativeConfig = {
    template: opts.template,
    gradientId: opts.gradientId as any,
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

  const buffer =
    isStory
      ? await renderStoryCreative(productInput, heroImageUrl, config)
      : config.template === "bold"
      ? await renderBoldCreative(productInput, heroImageUrl, config)
      : config.template === "collage"
      ? await renderCollageCreative(productInput, heroImageUrl, supporting, config)
      : await renderInstagramCreative(productInput, heroImageUrl, supporting, config);

  const id = nanoid(10);
  const [imageUrl, thumbUrl] = await Promise.all([
    storage.save(`social/${product.id}/${id}.png`, buffer),
    // A small WebP thumbnail so the Post History gallery never has to load
    // full-resolution generated PNGs (which can be 1080x1920) just to show
    // a preview tile.
    sharp(buffer)
      .resize({ width: 320 })
      .webp({ quality: 78 })
      .toBuffer()
      .then((thumb) => storage.save(`social/${product.id}/${id}-thumb.webp`, thumb)),
  ]);

  const creative = await prisma.socialCreative.create({
    data: { productId: product.id, platform: opts.platform, config: config as any, imageUrl, thumbUrl, createdById },
  });

  return creative;
}

router.post(
  "/generate",
  validateBody(generateOptionsSchema.extend({ productId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const { productId, ...opts } = req.body as GenerateOptions & { productId: string };
    const creative = await generateCreative(productId, opts, req.user!.id);

    recordAudit(req, {
      action: "social.creative.generated",
      entityType: "SocialCreative",
      entityId: creative.id,
      meta: { platform: creative.platform, productId },
    });

    res.status(201).json({ creative });
  })
);

router.post(
  "/creatives/:id/regenerate",
  asyncHandler(async (req, res) => {
    const existing = await prisma.socialCreative.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) throw new ApiError(404, "Creative not found");

    const opts = { platform: existing.platform, ...(existing.config as any) } as GenerateOptions;
    const creative = await generateCreative(existing.productId, opts, req.user!.id);

    recordAudit(req, {
      action: "social.creative.regenerated",
      entityType: "SocialCreative",
      entityId: creative.id,
      meta: { sourceId: existing.id, productId: existing.productId },
    });

    res.status(201).json({ creative });
  })
);

// Global Post History — every generated creative across every product, not
// just one. Thumbnails only, paginated, so opening this page never pulls
// down a wall of full-resolution images.
const listCreativesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});

router.get(
  "/creatives",
  validateQuery(listCreativesSchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listCreativesSchema>;
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.socialCreative.findMany({
        where,
        include: {
          product: { select: { id: true, title: true, slug: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.socialCreative.count({ where }),
    ]);
    res.json({ items, total, page: q.page, totalPages: Math.ceil(total / q.limit) });
  })
);

router.delete(
  "/creatives/:id",
  asyncHandler(async (req, res) => {
    const creative = await prisma.socialCreative.findUnique({ where: { id: req.params.id } });
    if (!creative || creative.deletedAt) throw new ApiError(404, "Creative not found");

    // Soft-delete keeps the row (and the audit trail below) for history;
    // the actual image files are removed since nothing needs them anymore.
    await prisma.socialCreative.update({ where: { id: creative.id }, data: { deletedAt: new Date() } });
    await Promise.all([
      storage.delete(creative.imageUrl).catch(() => {}),
      creative.thumbUrl ? storage.delete(creative.thumbUrl).catch(() => {}) : Promise.resolve(),
    ]);

    recordAudit(req, { action: "social.creative.deleted", entityType: "SocialCreative", entityId: creative.id });
    res.json({ ok: true });
  })
);

router.get(
  "/history/:productId",
  asyncHandler(async (req, res) => {
    const creatives = await prisma.socialCreative.findMany({
      where: { productId: req.params.productId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json({ creatives });
  })
);

export default router;
