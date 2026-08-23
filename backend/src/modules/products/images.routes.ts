import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { imageUpload } from "../../middleware/upload";
import { processProductImage } from "../../utils/image";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS } from "../../shared";

const router = Router({ mergeParams: true });

// Batch upload: accepts up to 20 images in one request, processes each with
// sharp (WebP + AVIF, three responsive widths) and persists them in the
// order received. First image on a product with none yet becomes primary.
router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  imageUpload.array("images", 20),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(404, "Product not found");

    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) throw new ApiError(400, "No images were uploaded");

    const existingCount = await prisma.productImage.count({ where: { productId } });
    const currentMax = await prisma.productImage.aggregate({
      where: { productId },
      _max: { sortOrder: true },
    });
    let nextSort = (currentMax._max.sortOrder ?? -1) + 1;

    const created = [];
    for (let i = 0; i < files.length; i++) {
      const processed = await processProductImage(files[i].buffer, `products/${productId}`);
      const image = await prisma.productImage.create({
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

    await recordAudit(req, {
      action: "product.images.uploaded",
      entityType: "Product",
      entityId: productId,
      meta: { count: created.length },
    });
    res.status(201).json({ images: created });
  })
);

router.patch(
  "/:imageId/primary",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    await prisma.$transaction([
      prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } }),
      prisma.productImage.update({ where: { id: req.params.imageId }, data: { isPrimary: true } }),
    ]);
    res.json({ ok: true });
  })
);

const reorderSchema = z.object({ order: z.array(z.string()).min(1) });

router.patch(
  "/reorder",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  validateBody(reorderSchema),
  asyncHandler(async (req, res) => {
    await prisma.$transaction(
      req.body.order.map((imageId: string, index: number) =>
        prisma.productImage.update({ where: { id: imageId }, data: { sortOrder: index } })
      )
    );
    res.json({ ok: true });
  })
);

router.delete(
  "/:imageId",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  asyncHandler(async (req, res) => {
    await prisma.productImage.delete({ where: { id: req.params.imageId } });
    await recordAudit(req, {
      action: "product.image.deleted",
      entityType: "Product",
      entityId: req.params.id,
      meta: { imageId: req.params.imageId },
    });
    res.json({ ok: true });
  })
);

export default router;
