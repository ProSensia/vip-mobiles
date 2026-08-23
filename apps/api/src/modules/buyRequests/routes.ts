import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { publicFormLimiter } from "../../middleware/rateLimit";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS } from "@vip/shared";

const router = Router();

const createSchema = z.object({
  productId: z.string().min(1),
  variantLabel: z.string().max(120).optional().nullable(),
  customerName: z.string().min(2).max(150),
  contact: z.string().min(3).max(150),
  offeredPrice: z.coerce.number().positive().optional().nullable(),
  message: z.string().max(1000).optional().nullable(),
});

// Public: logged by the store even though the actual conversation happens over
// WhatsApp — this keeps a record admins can follow up on from the dashboard.
router.post(
  "/",
  publicFormLimiter,
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.body.productId } });
    if (!product) throw new ApiError(404, "Product not found");

    const buyRequest = await prisma.buyRequest.create({ data: req.body });
    res.status(201).json({ buyRequest: { id: buyRequest.id } });
  })
);

router.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.BUY_REQUESTS_VIEW),
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const requests = await prisma.buyRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: { product: { select: { id: true, title: true, slug: true, basePrice: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ requests });
  })
);

const updateSchema = z.object({ status: z.enum(["NEW", "CONTACTED", "CLOSED"]) });

router.patch(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.BUY_REQUESTS_MANAGE),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const buyRequest = await prisma.buyRequest.update({
      where: { id: req.params.id },
      data: { status: req.body.status, handledById: req.user!.id },
    });
    await recordAudit(req, { action: "buyRequest.updated", entityType: "BuyRequest", entityId: buyRequest.id });
    res.json({ buyRequest });
  })
);

export default router;
