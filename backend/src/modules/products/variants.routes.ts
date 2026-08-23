import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS } from "@vip/shared";

const router = Router({ mergeParams: true });

const variantSchema = z.object({
  colorId: z.string().optional().nullable(),
  storage: z.string().max(40).optional().nullable(),
  ram: z.string().max(40).optional().nullable(),
  sku: z.string().max(80).optional().nullable(),
  price: z.coerce.number().positive(),
  stockQty: z.coerce.number().int().min(0).default(1),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "HIDDEN"]).optional(),
  isDefault: z.boolean().optional(),
});

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  validateBody(variantSchema),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(404, "Product not found");

    if (req.body.isDefault) {
      await prisma.productVariant.updateMany({ where: { productId }, data: { isDefault: false } });
    }

    const variant = await prisma.productVariant.create({ data: { ...req.body, productId } });
    await recordAudit(req, { action: "variant.created", entityType: "ProductVariant", entityId: variant.id });
    res.status(201).json({ variant });
  })
);

router.patch(
  "/:variantId",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  validateBody(variantSchema.partial()),
  asyncHandler(async (req, res) => {
    if (req.body.isDefault) {
      await prisma.productVariant.updateMany({
        where: { productId: req.params.id },
        data: { isDefault: false },
      });
    }
    const variant = await prisma.productVariant.update({
      where: { id: req.params.variantId },
      data: req.body,
    });
    await recordAudit(req, { action: "variant.updated", entityType: "ProductVariant", entityId: variant.id });
    res.json({ variant });
  })
);

router.delete(
  "/:variantId",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  asyncHandler(async (req, res) => {
    await prisma.productVariant.delete({ where: { id: req.params.variantId } });
    await recordAudit(req, { action: "variant.deleted", entityType: "ProductVariant", entityId: req.params.variantId });
    res.json({ ok: true });
  })
);

export default router;
