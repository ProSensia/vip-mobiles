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
const shared_1 = require("@vip/shared");
const router = (0, express_1.Router)();
const createSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1),
    variantLabel: zod_1.z.string().max(120).optional().nullable(),
    customerName: zod_1.z.string().min(2).max(150),
    contact: zod_1.z.string().min(3).max(150),
    offeredPrice: zod_1.z.coerce.number().positive().optional().nullable(),
    message: zod_1.z.string().max(1000).optional().nullable(),
});
// Public: logged by the store even though the actual conversation happens over
// WhatsApp — this keeps a record admins can follow up on from the dashboard.
router.post("/", rateLimit_1.publicFormLimiter, (0, validate_1.validateBody)(createSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const product = await prisma_1.prisma.product.findUnique({ where: { id: req.body.productId } });
    if (!product)
        throw new errorHandler_1.ApiError(404, "Product not found");
    const buyRequest = await prisma_1.prisma.buyRequest.create({ data: req.body });
    res.status(201).json({ buyRequest: { id: buyRequest.id } });
}));
router.get("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.BUY_REQUESTS_VIEW), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const status = req.query.status;
    const requests = await prisma_1.prisma.buyRequest.findMany({
        where: status ? { status: status } : undefined,
        include: { product: { select: { id: true, title: true, slug: true, basePrice: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
    });
    res.json({ requests });
}));
const updateSchema = zod_1.z.object({ status: zod_1.z.enum(["NEW", "CONTACTED", "CLOSED"]) });
router.patch("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.BUY_REQUESTS_MANAGE), (0, validate_1.validateBody)(updateSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const buyRequest = await prisma_1.prisma.buyRequest.update({
        where: { id: req.params.id },
        data: { status: req.body.status, handledById: req.user.id },
    });
    await (0, audit_1.recordAudit)(req, { action: "buyRequest.updated", entityType: "BuyRequest", entityId: buyRequest.id });
    res.json({ buyRequest });
}));
exports.default = router;
