"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const audit_1 = require("../../utils/audit");
const shared_1 = require("../../shared");
const router = (0, express_1.Router)({ mergeParams: true });
const reviewSchema = zod_1.z.object({
    customerName: zod_1.z.string().min(1).max(120),
    rating: zod_1.z.coerce.number().int().min(1).max(5),
    comment: zod_1.z.string().max(2000).optional().nullable(),
});
// Public: a shopper can submit a review, but it stays hidden until an admin approves it.
router.post("/submit", rateLimit_1.publicFormLimiter, (0, validate_1.validateBody)(reviewSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const review = await prisma_1.prisma.review.create({
        data: { ...req.body, productId: req.params.id, isApproved: false },
    });
    res.status(201).json({ review: { id: review.id }, message: "Thanks! Your review will appear after moderation." });
}));
// Admin: create a pre-approved review (curated content) directly.
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_MANAGE_REVIEWS), (0, validate_1.validateBody)(reviewSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const review = await prisma_1.prisma.review.create({
        data: { ...req.body, productId: req.params.id, isApproved: true },
    });
    (0, audit_1.recordAudit)(req, { action: "review.created", entityType: "Review", entityId: review.id });
    res.status(201).json({ review });
}));
router.get("/pending", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_MANAGE_REVIEWS), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const reviews = await prisma_1.prisma.review.findMany({
        where: { productId: req.params.id, isApproved: false },
        orderBy: { createdAt: "desc" },
    });
    res.json({ reviews });
}));
router.patch("/:reviewId/approve", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_MANAGE_REVIEWS), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const review = await prisma_1.prisma.review.update({ where: { id: req.params.reviewId }, data: { isApproved: true } });
    (0, audit_1.recordAudit)(req, { action: "review.approved", entityType: "Review", entityId: review.id });
    res.json({ review });
}));
router.delete("/:reviewId", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_MANAGE_REVIEWS), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.review.delete({ where: { id: req.params.reviewId } });
    (0, audit_1.recordAudit)(req, { action: "review.deleted", entityType: "Review", entityId: req.params.reviewId });
    res.json({ ok: true });
}));
exports.default = router;
