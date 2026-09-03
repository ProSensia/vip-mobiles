import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { hasPermission, PERMISSIONS } from "../../shared";

// Serialized inventory (IMEI/QR-tracked physical units) scoped to one
// product — mounted at /products/:id/units. Adding/removing a unit here is
// what a product's "stock count" now derives from whenever any units
// exist; see products/routes.ts for how that's folded into the public
// product read paths, and inventory/routes.ts for the scan-to-sell flow
// that consumes these.
const router = Router({ mergeParams: true });

// Purchase price is the one field on a unit that must never reach a caller
// without financial visibility — strip it at the response boundary rather
// than relying on every call site to remember to omit it.
function sanitizeUnit(unit: any, canSeeCost: boolean) {
  if (canSeeCost) return unit;
  const { purchasePrice, ...rest } = unit;
  return rest;
}

const unitSchema = z
  .object({
    variantId: z.string().optional().nullable(),
    branchId: z.string().optional().nullable(),
    qrCode: z.string().trim().min(1).max(191).optional().nullable(),
    imei1: z.string().trim().min(1).max(191).optional().nullable(),
    imei2: z.string().trim().min(1).max(191).optional().nullable(),
    purchasePrice: z.coerce.number().positive().optional().nullable(),
  })
  .refine((v) => v.qrCode || v.imei1, {
    message: "Scan a QR/barcode (new mobile) or an IMEI (used mobile) to identify this unit",
  });

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE_STOCK),
  validateBody(unitSchema),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(404, "Product not found");

    const canSeeCost = hasPermission(req.user!, PERMISSIONS.SALES_ANALYTICS);

    try {
      const unit = await prisma.$transaction(async (tx) => {
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
            addedById: req.user!.id,
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

      recordAudit(req, { action: "inventoryUnit.added", entityType: "InventoryUnit", entityId: unit.id, meta: { productId } });
      res.status(201).json({ unit: sanitizeUnit(unit, canSeeCost) });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const field = (err.meta?.target as string[] | undefined)?.[0] ?? "code";
        throw new ApiError(409, `This ${field === "qrCode" ? "QR/barcode" : "IMEI"} is already registered to another unit`);
      }
      throw err;
    }
  })
);

router.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  asyncHandler(async (req, res) => {
    const canSeeCost = hasPermission(req.user!, PERMISSIONS.SALES_ANALYTICS);
    const units = await prisma.inventoryUnit.findMany({
      where: { productId: req.params.id },
      include: {
        variant: { select: { id: true, storage: true, ram: true, color: { select: { name: true } } } },
        branch: { select: { id: true, name: true } },
        addedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ units: units.map((u) => sanitizeUnit(u, canSeeCost)) });
  })
);

router.delete(
  "/:unitId",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_MANAGE_STOCK),
  asyncHandler(async (req, res) => {
    const unit = await prisma.inventoryUnit.findUnique({ where: { id: req.params.unitId } });
    if (!unit) throw new ApiError(404, "Unit not found");
    if (unit.status === "SOLD") throw new ApiError(400, "This unit has already been sold — its sale record must stay intact");

    await prisma.$transaction(async (tx) => {
      await tx.inventoryUnit.delete({ where: { id: req.params.unitId } });
      if (unit.variantId) {
        const variantInStock = await tx.inventoryUnit.count({ where: { variantId: unit.variantId, status: "IN_STOCK" } });
        await tx.productVariant.update({ where: { id: unit.variantId }, data: { stockQty: variantInStock } });
      }
    });
    recordAudit(req, { action: "inventoryUnit.removed", entityType: "InventoryUnit", entityId: req.params.unitId });
    res.json({ ok: true });
  })
);

export default router;
