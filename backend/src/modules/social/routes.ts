import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { storage } from "../../lib/storage";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS, SOCIAL_GRADIENTS } from "../../shared";
import { renderInstagramCreative, renderTikTokCreative, formatCreativePrice } from "./render";

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
  platform: z.enum(["INSTAGRAM", "TIKTOK"]),
  format: z.enum(["square", "portrait"]).optional(),
  gradientId: z.string().optional(),
  showLogo: z.boolean().optional(),
  showPrice: z.boolean().optional(),
  showDescription: z.boolean().optional(),
  showCTA: z.boolean().optional(),
  showSupportingImages: z.boolean().optional(),
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
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });
    if (!product) throw new ApiError(404, "Product not found");
    if (product.images.length === 0) throw new ApiError(400, "This product has no images to generate a creative from");

    const setting = await prisma.setting.findUnique({ where: { key: "currency" } });
    const currency = (setting?.value as string) || "PKR";

    const primary = product.images.find((i) => i.isPrimary) ?? product.images[0];
    const supporting = product.images.filter((i) => i.id !== primary.id).map((i) => i.webpUrl || i.url);

    const productInput = {
      title: product.title,
      price: formatCreativePrice(Number(product.basePrice), currency),
      description: product.description,
    };

    const config = {
      gradientId: body.gradientId as any,
      format: body.format,
      showLogo: body.showLogo,
      showPrice: body.showPrice,
      showDescription: body.showDescription,
      showCTA: body.showCTA,
      showSupportingImages: body.showSupportingImages,
      ctaText: body.ctaText,
      description: body.description,
    };

    const buffer =
      body.platform === "INSTAGRAM"
        ? await renderInstagramCreative(productInput, primary.webpUrl || primary.url, supporting, config)
        : await renderTikTokCreative(productInput, primary.webpUrl || primary.url, config);

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
