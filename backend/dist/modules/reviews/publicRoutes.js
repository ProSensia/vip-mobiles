"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const upload_1 = require("../../middleware/upload");
const image_1 = require("../../utils/image");
const notifications_1 = require("../../utils/notifications");
const shared_1 = require("../../shared");
// Public endpoints reached by scanning a Sale's review QR code — looked up
// by the unguessable Sale.reviewToken rather than a product/review id, since
// the shopper only ever has the token (printed on a receipt/QR).
const router = (0, express_1.Router)();
router.get("/token/:token", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const sale = await prisma_1.prisma.sale.findUnique({
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
    if (!sale)
        throw new errorHandler_1.ApiError(404, "This review link is invalid");
    res.json({
        product: sale.product,
        alreadySubmitted: !!sale.reviewSubmittedAt,
    });
}));
const submitSchema = zod_1.z.object({
    customerName: zod_1.z.string().min(1).max(120),
    rating: zod_1.z.coerce.number().int().min(1).max(5),
    comment: zod_1.z.string().max(2000).optional().nullable(),
});
router.post("/token/:token", rateLimit_1.publicFormLimiter, upload_1.imageUpload.single("photo"), (0, validate_1.validateBody)(submitSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const sale = await prisma_1.prisma.sale.findUnique({
        where: { reviewToken: req.params.token },
        select: { id: true, productId: true, reviewSubmittedAt: true, product: { select: { title: true } } },
    });
    if (!sale)
        throw new errorHandler_1.ApiError(404, "This review link is invalid");
    if (sale.reviewSubmittedAt)
        throw new errorHandler_1.ApiError(400, "A review has already been submitted for this purchase");
    const photoUrl = req.file ? (await (0, image_1.processGenericImage)(req.file.buffer, "reviews", 1200)).url : null;
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.review.create({
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
        prisma_1.prisma.sale.update({ where: { id: sale.id }, data: { reviewSubmittedAt: new Date() } }),
    ]);
    (0, notifications_1.notifyUsersWithPermission)(shared_1.PERMISSIONS.PRODUCTS_MANAGE_REVIEWS, {
        type: "REVIEW_SUBMITTED",
        title: "New Verified Review Awaiting Approval",
        message: `${req.body.customerName} left a ${req.body.rating}★ verified review${sale.product ? ` on ${sale.product.title}` : ""}`,
        link: `/admin/products/${sale.productId}`,
    });
    res.status(201).json({ message: "Thanks! Your review will appear after moderation." });
}));
// Authenticated: powers the centralized Approvals & Requests admin page —
// every pending review across the whole catalog in one list, instead of
// having to open each product individually to find one awaiting moderation.
router.get("/pending", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_MANAGE_REVIEWS), (0, errorHandler_1.asyncHandler)(async (_req, res) => {
    const reviews = await prisma_1.prisma.review.findMany({
        where: { isApproved: false },
        include: {
            product: { select: { id: true, title: true, slug: true, images: { where: { isPrimary: true }, take: 1, select: { thumbUrl: true, url: true } } } },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
    });
    res.json({ reviews });
}));
exports.default = router;
