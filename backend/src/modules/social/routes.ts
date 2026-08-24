import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { storage } from "../../lib/storage";
import { recordAudit } from "../../utils/audit";
import { env } from "../../env";
import { PERMISSIONS, SOCIAL_GRADIENTS, computeDiscountPercent, computeStockLevel } from "../../shared";
import { renderInstagramCreative, renderStoryCreative, renderBoldCreative, formatCreativePrice, type CreativeBadge } from "./render";

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.SOCIAL_GENERATE));

router.get(
  "/gradients",
  asyncHandler(async (_req, res) => {
    res.json({ gradients: SOCIAL_GRADIENTS });
  })
);

const generateSchema = z.object({
  productId: z.string().min(1),
  imageId: z.string().optional(), // pick a specific product photo as the hero shot; defaults to primary
  platform: z.enum(["INSTAGRAM", "TIKTOK"]),
  format: z.enum(["square", "portrait", "story"]).optional(),
  template: z.enum(["classic", "bold"]).optional(),
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

router.post(
  "/generate",
  validateBody(generateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof generateSchema>;
    const product = await prisma.product.findUnique({
      where: { id: body.productId },
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

    const chosenImage = body.imageId ? product.images.find((i) => i.id === body.imageId) : undefined;
    const primary = chosenImage ?? product.images.find((i) => i.isPrimary) ?? product.images[0];
    const supporting = product.images.filter((i) => i.id !== primary.id).map((i) => i.webpUrl || i.url);

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
      stockLevel === "LOW_STOCK"
        ? "⚠ Only a few left in stock"
        : stockLevel === "OUT_OF_STOCK"
        ? null
        : "✓ In Stock";

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

    const config = {
      template: body.template,
      gradientId: body.gradientId as any,
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

    const buffer =
      config.template === "bold" && !isStory
        ? await renderBoldCreative(productInput, heroImageUrl, config)
        : isStory
        ? await renderStoryCreative(productInput, heroImageUrl, config)
        : await renderInstagramCreative(productInput, heroImageUrl, supporting, config);

    const filename = `social/${product.id}/${nanoid(10)}.png`;
    const imageUrl = await storage.save(filename, buffer);

    const creative = await prisma.socialCreative.create({
      data: {
        productId: product.id,
        platform: body.platform,
        config: config as any,
        imageUrl,
        createdById: req.user!.id,
      },
    });

    recordAudit(req, {
      action: "social.creative.generated",
      entityType: "SocialCreative",
      entityId: creative.id,
      meta: { platform: body.platform, productId: product.id },
    });

    res.status(201).json({ creative });
  })
);

router.get(
  "/history/:productId",
  asyncHandler(async (req, res) => {
    const creatives = await prisma.socialCreative.findMany({
      where: { productId: req.params.productId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json({ creatives });
  })
);

export default router;
