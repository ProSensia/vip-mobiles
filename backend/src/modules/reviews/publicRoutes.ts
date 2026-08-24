import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { publicFormLimiter } from "../../middleware/rateLimit";
import { imageUpload } from "../../middleware/upload";
import { processGenericImage } from "../../utils/image";
import { notifyUsersWithPermission } from "../../utils/notifications";
import { PERMISSIONS } from "../../shared";

// Public endpoints reached by scanning a Sale's review QR code — looked up
// by the unguessable Sale.reviewToken rather than a product/review id, since
// the shopper only ever has the token (printed on a receipt/QR).
const router = Router();

router.get(
  "/token/:token",
  asyncHandler(async (req, res) => {
    const sale = await prisma.sale.findUnique({
      where: { reviewToken: req.params.token },
      select: {
        reviewSubmittedAt: true,
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            images: { where: { isPrimary: true }, take: 1, select: { thumbUrl: true, url: true } },
          },
        },
      },
    });
    if (!sale) throw new ApiError(404, "This review link is invalid");

    res.json({
      product: sale.product,
      alreadySubmitted: !!sale.reviewSubmittedAt,
    });
  })
);

const submitSchema = z.object({
  customerName: z.string().min(1).max(120),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

router.post(
  "/token/:token",
  publicFormLimiter,
  imageUpload.single("photo"),
  validateBody(submitSchema),
  asyncHandler(async (req, res) => {
    const sale = await prisma.sale.findUnique({
      where: { reviewToken: req.params.token },
      select: { id: true, productId: true, reviewSubmittedAt: true, product: { select: { title: true } } },
    });
    if (!sale) throw new ApiError(404, "This review link is invalid");
    if (sale.reviewSubmittedAt) throw new ApiError(400, "A review has already been submitted for this purchase");

    const photoUrl = req.file ? (await processGenericImage(req.file.buffer, "reviews", 1200)).url : null;

    await prisma.$transaction([
      prisma.review.create({
        data: {
          productId: sale.productId,
          saleId: sale.id,
          customerName: req.body.customerName,
          rating: req.body.rating,
          comment: req.body.comment,
          photoUrl,
          isVerified: true,
          isApproved: false,
        },
      }),
      prisma.sale.update({ where: { id: sale.id }, data: { reviewSubmittedAt: new Date() } }),
    ]);

    notifyUsersWithPermission(PERMISSIONS.PRODUCTS_MANAGE_REVIEWS, {
      type: "REVIEW_SUBMITTED",
      title: "New Verified Review Awaiting Approval",
      message: `${req.body.customerName} left a ${req.body.rating}★ verified review${sale.product ? ` on ${sale.product.title}` : ""}`,
      link: `/admin/products/${sale.productId}`,
    });

    res.status(201).json({ message: "Thanks! Your review will appear after moderation." });
  })
);

// Authenticated: powers the centralized Approvals & Requests admin page —
// every pending review across the whole catalog in one list, instead of
// having to open each product individually to find one awaiting moderation.
router.get(
  "/pending",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE_REVIEWS),
  asyncHandler(async (_req, res) => {
    const reviews = await prisma.review.findMany({
      where: { isApproved: false },
      include: {
        product: { select: { id: true, title: true, slug: true, images: { where: { isPrimary: true }, take: 1, select: { thumbUrl: true, url: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json({ reviews });
  })
);

export default router;
