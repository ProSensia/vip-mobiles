"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
const shared_1 = require("@vip/shared");
const router = (0, express_1.Router)({ mergeParams: true });
const variantSchema = zod_1.z.object({
    colorId: zod_1.z.string().optional().nullable(),
    storage: zod_1.z.string().max(40).optional().nullable(),
    ram: zod_1.z.string().max(40).optional().nullable(),
    sku: zod_1.z.string().max(80).optional().nullable(),
    price: zod_1.z.coerce.number().positive(),
    stockQty: zod_1.z.coerce.number().int().min(0).default(1),
    status: zod_1.z.enum(["AVAILABLE", "RESERVED", "SOLD", "HIDDEN"]).optional(),
    isDefault: zod_1.z.boolean().optional(),
});
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_EDIT), (0, validate_1.validateBody)(variantSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const productId = req.params.id;
    const product = await prisma_1.prisma.product.findUnique({ where: { id: productId } });
    if (!product)
        throw new errorHandler_1.ApiError(404, "Product not found");
    if (req.body.isDefault) {
        await prisma_1.prisma.productVariant.updateMany({ where: { productId }, data: { isDefault: false } });
    }
    const variant = await prisma_1.prisma.productVariant.create({ data: { ...req.body, productId } });
    await (0, audit_1.recordAudit)(req, { action: "variant.created", entityType: "ProductVariant", entityId: variant.id });
    res.status(201).json({ variant });
}));
router.patch("/:variantId", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_EDIT), (0, validate_1.validateBody)(variantSchema.partial()), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (req.body.isDefault) {
        await prisma_1.prisma.productVariant.updateMany({
            where: { productId: req.params.id },
            data: { isDefault: false },
        });
    }
    const variant = await prisma_1.prisma.productVariant.update({
        where: { id: req.params.variantId },
        data: req.body,
    });
    await (0, audit_1.recordAudit)(req, { action: "variant.updated", entityType: "ProductVariant", entityId: variant.id });
    res.json({ variant });
}));
router.delete("/:variantId", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_EDIT), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.productVariant.delete({ where: { id: req.params.variantId } });
    await (0, audit_1.recordAudit)(req, { action: "variant.deleted", entityType: "ProductVariant", entityId: req.params.variantId });
    res.json({ ok: true });
}));
exports.default = router;
