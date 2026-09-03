"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = require("../../lib/prisma");
const errorHandler_1 = require("../../middleware/errorHandler");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
const shared_1 = require("../../shared");
// Serialized inventory (IMEI/QR-tracked physical units) scoped to one
// product — mounted at /products/:id/units. Adding/removing a unit here is
// what a product's "stock count" now derives from whenever any units
// exist; see products/routes.ts for how that's folded into the public
// product read paths, and inventory/routes.ts for the scan-to-sell flow
// that consumes these.
const router = (0, express_1.Router)({ mergeParams: true });
// Purchase price is the one field on a unit that must never reach a caller
// without financial visibility — strip it at the response boundary rather
// than relying on every call site to remember to omit it.
function sanitizeUnit(unit, canSeeCost) {
    if (canSeeCost)
        return unit;
    const { purchasePrice, ...rest } = unit;
    return rest;
}
const unitSchema = zod_1.z
    .object({
    variantId: zod_1.z.string().optional().nullable(),
    branchId: zod_1.z.string().optional().nullable(),
    qrCode: zod_1.z.string().trim().min(1).max(191).optional().nullable(),
    imei1: zod_1.z.string().trim().min(1).max(191).optional().nullable(),
    imei2: zod_1.z.string().trim().min(1).max(191).optional().nullable(),
    purchasePrice: zod_1.z.coerce.number().positive().optional().nullable(),
})
    .refine((v) => v.qrCode || v.imei1, {
    message: "Scan a QR/barcode (new mobile) or an IMEI (used mobile) to identify this unit",
});
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_MANAGE_STOCK), (0, validate_1.validateBody)(unitSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const productId = req.params.id;
    const product = await prisma_1.prisma.product.findUnique({ where: { id: productId } });
    if (!product)
        throw new errorHandler_1.ApiError(404, "Product not found");
    const canSeeCost = (0, shared_1.hasPermission)(req.user, shared_1.PERMISSIONS.SALES_ANALYTICS);
    try {
        const unit = await prisma_1.prisma.$transaction(async (tx) => {
            const created = await tx.inventoryUnit.create({
                data: {
                    productId,
                    variantId: req.body.variantId || null,
                    branchId: req.body.branchId || product.branchId || null,
                    qrCode: req.body.qrCode || null,
                    imei1: req.body.imei1 || null,
                    imei2: req.body.imei2 || null,
                    // Never trust a client-sent purchase price from someone who
                    // isn't allowed to see purchase prices in the first place.
                    purchasePrice: canSeeCost ? req.body.purchasePrice ?? null : null,
                    addedById: req.user.id,
                },
            });
            // A unit just became available — make sure the product isn't
            // sitting HIDDEN/SOLD from before. Respects an explicit HIDDEN.
            if (product.status === "SOLD") {
                await tx.product.update({ where: { id: productId }, data: { status: "AVAILABLE", soldAt: null, soldPrice: null } });
            }
            if (created.variantId) {
                const variantInStock = await tx.inventoryUnit.count({ where: { variantId: created.variantId, status: "IN_STOCK" } });
                await tx.productVariant.update({ where: { id: created.variantId }, data: { stockQty: variantInStock } });
            }
            return created;
        });
        (0, audit_1.recordAudit)(req, { action: "inventoryUnit.added", entityType: "InventoryUnit", entityId: unit.id, meta: { productId } });
        res.status(201).json({ unit: sanitizeUnit(unit, canSeeCost) });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const field = err.meta?.target?.[0] ?? "code";
            throw new errorHandler_1.ApiError(409, `This ${field === "qrCode" ? "QR/barcode" : "IMEI"} is already registered to another unit`);
        }
        throw err;
    }
}));
router.get("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_VIEW), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const canSeeCost = (0, shared_1.hasPermission)(req.user, shared_1.PERMISSIONS.SALES_ANALYTICS);
    const units = await prisma_1.prisma.inventoryUnit.findMany({
        where: { productId: req.params.id },
        include: {
            variant: { select: { id: true, storage: true, ram: true, color: { select: { name: true } } } },
            branch: { select: { id: true, name: true } },
            addedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    res.json({ units: units.map((u) => sanitizeUnit(u, canSeeCost)) });
}));
router.delete("/:unitId", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_MANAGE_STOCK), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const unit = await prisma_1.prisma.inventoryUnit.findUnique({ where: { id: req.params.unitId } });
    if (!unit)
        throw new errorHandler_1.ApiError(404, "Unit not found");
    if (unit.status === "SOLD")
        throw new errorHandler_1.ApiError(400, "This unit has already been sold — its sale record must stay intact");
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.inventoryUnit.delete({ where: { id: req.params.unitId } });
        if (unit.variantId) {
            const variantInStock = await tx.inventoryUnit.count({ where: { variantId: unit.variantId, status: "IN_STOCK" } });
            await tx.productVariant.update({ where: { id: unit.variantId }, data: { stockQty: variantInStock } });
        }
    });
    (0, audit_1.recordAudit)(req, { action: "inventoryUnit.removed", entityType: "InventoryUnit", entityId: req.params.unitId });
    res.json({ ok: true });
}));
exports.default = router;
