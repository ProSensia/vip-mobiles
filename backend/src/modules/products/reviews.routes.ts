import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { publicFormLimiter } from "../../middleware/rateLimit";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS } from "../../shared";

const router = Router({ mergeParams: true });

const reviewSchema = z.object({
  customerName: z.string().min(1).max(120),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

// Public: a shopper can submit a review, but it stays hidden until an admin approves it.
router.post(
  "/submit",
  publicFormLimiter,
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const review = await prisma.review.create({
      data: { ...req.body, productId: req.params.id, isApproved: false },
    });
    res.status(201).json({ review: { id: review.id }, message: "Thanks! Your review will appear after moderation." });
  })
);

// Admin: create a pre-approved review (curated content) directly.
router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE_REVIEWS),
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const review = await prisma.review.create({
      data: { ...req.body, productId: req.params.id, isApproved: true },
    });
    await recordAudit(req, { action: "review.created", entityType: "Review", entityId: review.id });
    res.status(201).json({ review });
  })
);

router.get(
  "/pending",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE_REVIEWS),
  asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.id, isApproved: false },
      orderBy: { createdAt: "desc" },
    });
    res.json({ reviews });
  })
);

router.patch(
  "/:reviewId/approve",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE_REVIEWS),
  asyncHandler(async (req, res) => {
    const review = await prisma.review.update({ where: { id: req.params.reviewId }, data: { isApproved: true } });
    await recordAudit(req, { action: "review.approved", entityType: "Review", entityId: review.id });
    res.json({ review });
  })
);

router.delete(
  "/:reviewId",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE_REVIEWS),
  asyncHandler(async (req, res) => {
    await prisma.review.delete({ where: { id: req.params.reviewId } });
    await recordAudit(req, { action: "review.deleted", entityType: "Review", entityId: req.params.reviewId });
    res.json({ ok: true });
  })
);

export default router;
