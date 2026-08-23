"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const upload_1 = require("../../middleware/upload");
const image_1 = require("../../utils/image");
const audit_1 = require("../../utils/audit");
const shared_1 = require("../../shared");
const router = (0, express_1.Router)({ mergeParams: true });
// Batch upload: accepts up to 20 images in one request, processes each with
// sharp (WebP + AVIF, three responsive widths) and persists them in the
// order received. First image on a product with none yet becomes primary.
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_EDIT), upload_1.imageUpload.array("images", 20), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const productId = req.params.id;
    const product = await prisma_1.prisma.product.findUnique({ where: { id: productId } });
    if (!product)
        throw new errorHandler_1.ApiError(404, "Product not found");
    const files = req.files ?? [];
    if (files.length === 0)
        throw new errorHandler_1.ApiError(400, "No images were uploaded");
    const existingCount = await prisma_1.prisma.productImage.count({ where: { productId } });
    const currentMax = await prisma_1.prisma.productImage.aggregate({
        where: { productId },
        _max: { sortOrder: true },
    });
    let nextSort = (currentMax._max.sortOrder ?? -1) + 1;
    const created = [];
    for (let i = 0; i < files.length; i++) {
        const processed = await (0, image_1.processProductImage)(files[i].buffer, `products/${productId}`);
        const image = await prisma_1.prisma.productImage.create({
            data: {
                productId,
                url: processed.url,
                webpUrl: processed.webpUrl,
                avifUrl: processed.avifUrl,
                thumbUrl: processed.thumbUrl,
                width: processed.width,
                height: processed.height,
                sortOrder: nextSort++,
                isPrimary: existingCount === 0 && i === 0,
                altText: product.title,
            },
        });
        created.push(image);
    }
    await (0, audit_1.recordAudit)(req, {
        action: "product.images.uploaded",
        entityType: "Product",
        entityId: productId,
        meta: { count: created.length },
    });
    res.status(201).json({ images: created });
}));
router.patch("/:imageId/primary", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_EDIT), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const productId = req.params.id;
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } }),
        prisma_1.prisma.productImage.update({ where: { id: req.params.imageId }, data: { isPrimary: true } }),
    ]);
    res.json({ ok: true });
}));
const reorderSchema = zod_1.z.object({ order: zod_1.z.array(zod_1.z.string()).min(1) });
router.patch("/reorder", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_EDIT), (0, validate_1.validateBody)(reorderSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.$transaction(req.body.order.map((imageId, index) => prisma_1.prisma.productImage.update({ where: { id: imageId }, data: { sortOrder: index } })));
    res.json({ ok: true });
}));
router.delete("/:imageId", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_EDIT), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.productImage.delete({ where: { id: req.params.imageId } });
    await (0, audit_1.recordAudit)(req, {
        action: "product.image.deleted",
        entityType: "Product",
        entityId: req.params.id,
        meta: { imageId: req.params.imageId },
    });
    res.json({ ok: true });
}));
exports.default = router;
