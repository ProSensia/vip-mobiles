import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { notifyUser, notifyUsersWithPermission } from "../../utils/notifications";
import { hasPermission, PERMISSIONS } from "../../shared";

// Scan-driven sales: find a unit by its IMEI/QR, then sell it. Deliberately
// small — the actual add-unit / list-units endpoints live in
// products/units.routes.ts (scoped to a product), and everything sale-list
// / sold-inventory related reuses the existing sales/routes.ts (which now
// includes unit IMEI/QR on every row) rather than duplicating a second
// listing endpoint here.
const router = Router();
router.use(authenticate);

const lookupSchema = z.object({ code: z.string().trim().min(1).max(191) });

router.post(
  "/lookup",
  requirePermission(PERMISSIONS.SALES_RECORD),
  validateBody(lookupSchema),
  asyncHandler(async (req, res) => {
    const code = req.body.code as string;
    const unit = await prisma.inventoryUnit.findFirst({
      where: { OR: [{ qrCode: code }, { imei1: code }, { imei2: code }] },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            condition: true,
            basePrice: true,
            brand: { select: { name: true } },
            category: { select: { name: true } },
            images: { where: { isPrimary: true }, take: 1, select: { thumbUrl: true, url: true } },
          },
        },
        variant: { select: { id: true, storage: true, ram: true, color: { select: { name: true } } } },
        branch: { select: { id: true, name: true } },
      },
    });

    if (!unit) throw new ApiError(404, "No mobile found for this code — check it was scanned in first, or try again");
    if (unit.status === "SOLD") throw new ApiError(409, "This unit has already been sold");
    if (unit.status === "RESERVED") throw new ApiError(409, "This unit is currently reserved");

    // Purchase price never reaches the scan/sell screen, regardless of who's scanning.
    res.json({
      unit: { id: unit.id, imei1: unit.imei1, imei2: unit.imei2, qrCode: unit.qrCode, status: unit.status, createdAt: unit.createdAt },
      product: unit.product,
      variant: unit.variant,
      branch: unit.branch,
    });
  })
);

const sellSchema = z.object({
  soldPrice: z.coerce.number().positive(),
  customerName: z.string().max(150).optional().nullable(),
  customerContact: z.string().max(150).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

router.post(
  "/units/:id/sell",
  requirePermission(PERMISSIONS.SALES_RECORD),
  validateBody(sellSchema),
  asyncHandler(async (req, res) => {
    const canSeeCost = hasPermission(req.user!, PERMISSIONS.SALES_ANALYTICS);

    const result = await prisma.$transaction(async (tx) => {
      // Atomic claim: this only succeeds if the unit was still IN_STOCK at
      // the moment of the update, so two sellers scanning the same phone at
      // once can't both complete a sale for it (the loser's updateMany
      // matches zero rows and the transaction aborts).
      const claim = await tx.inventoryUnit.updateMany({
        where: { id: req.params.id, status: "IN_STOCK" },
        data: { status: "SOLD", soldAt: new Date() },
      });
      if (claim.count === 0) {
        const existing = await tx.inventoryUnit.findUnique({ where: { id: req.params.id } });
        if (!existing) throw new ApiError(404, "Unit not found");
        throw new ApiError(409, "This unit was already sold — someone beat you to it");
      }

      const unit = await tx.inventoryUnit.findUniqueOrThrow({ where: { id: req.params.id } });
      const profit = unit.purchasePrice != null ? Number(req.body.soldPrice) - Number(unit.purchasePrice) : null;

      const sale = await tx.sale.create({
        data: {
          productId: unit.productId,
          unitId: unit.id,
          variantId: unit.variantId,
          branchId: unit.branchId,
          staffId: req.user!.id,
          soldPrice: req.body.soldPrice,
          costPrice: unit.purchasePrice,
          profit: profit ?? undefined,
          customerName: req.body.customerName,
          customerContact: req.body.customerContact,
          notes: req.body.notes,
        },
        include: {
          product: { select: { id: true, title: true, slug: true, condition: true } },
          unit: { select: { id: true, imei1: true, imei2: true, qrCode: true } },
        },
      });

      if (unit.variantId) {
        // Set to the actual remaining count rather than blindly decrementing —
        // self-healing against any drift, and never goes negative.
        const variantRemaining = await tx.inventoryUnit.count({ where: { variantId: unit.variantId, status: "IN_STOCK" } });
        await tx.productVariant.update({ where: { id: unit.variantId }, data: { stockQty: variantRemaining } });
      }

      const remaining = await tx.inventoryUnit.count({ where: { productId: unit.productId, status: "IN_STOCK" } });
      if (remaining === 0) {
        await tx.product.update({
          where: { id: unit.productId },
          data: { status: "SOLD", soldAt: new Date(), soldPrice: req.body.soldPrice, isFeatured: false },
        });
      }

      return sale;
    });

    recordAudit(req, {
      action: "inventoryUnit.sold",
      entityType: "Sale",
      entityId: result.id,
      meta: { unitId: result.unitId, productId: result.productId },
    });

    // Same "close any open buy requests for this product" behavior as the
    // manual /sales endpoint — a completed sale is the natural end of one.
    const openBuyRequests = await prisma.buyRequest.findMany({
      where: { productId: result.productId, status: { notIn: ["REJECTED", "CANCELLED", "CLOSED"] } },
    });
    for (const br of openBuyRequests) {
      await prisma.buyRequest.update({ where: { id: br.id }, data: { status: "CLOSED" } });
      recordAudit(req, {
        action: "buyRequest.saleCompleted",
        entityType: "BuyRequest",
        entityId: br.id,
        meta: { previousStatus: br.status, newStatus: "CLOSED", saleId: result.id },
      });
      if (br.assignedToId && br.assignedToId !== req.user!.id) {
        notifyUser({
          userId: br.assignedToId,
          type: "BUY_REQUEST_STATUS_CHANGED",
          title: "Sale Completed",
          message: `${result.product.title} was sold — this buy request is now closed`,
          link: `/admin/buy-requests?id=${br.id}`,
        });
      }
    }

    notifyUsersWithPermission(
      PERMISSIONS.SALES_ANALYTICS,
      {
        type: "SALE_COMPLETED",
        title: "Sale Completed",
        message: `${result.product.title} sold for ${req.body.soldPrice}`,
        link: `/admin/sales`,
      },
      req.user!.id
    );

    res.status(201).json({ sale: canSeeCost ? result : { ...result, costPrice: null, profit: null } });
  })
);

export default router;
