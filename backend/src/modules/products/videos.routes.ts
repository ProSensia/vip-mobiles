import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler, ApiError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { authenticate, requirePermission } from "../../middleware/auth";
import { recordAudit } from "../../utils/audit";
import { PERMISSIONS, parseSocialVideoUrl } from "../../shared";

const router = Router({ mergeParams: true });

const videoSchema = z.object({
  url: z.string().url(),
  caption: z.string().max(300).optional().nullable(),
});

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  validateBody(videoSchema),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const { platform, embedId } = parseSocialVideoUrl(req.body.url);
    if (!platform) {
      throw new ApiError(400, "URL must be a supported YouTube, TikTok or Instagram link");
    }

    const count = await prisma.productVideo.count({ where: { productId } });
    const video = await prisma.productVideo.create({
      data: { productId, platform, url: req.body.url, embedId, caption: req.body.caption, sortOrder: count },
    });
    await recordAudit(req, { action: "video.created", entityType: "ProductVideo", entityId: video.id });
    res.status(201).json({ video });
  })
);

router.delete(
  "/:videoId",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_EDIT),
  asyncHandler(async (req, res) => {
    await prisma.productVideo.delete({ where: { id: req.params.videoId } });
    await recordAudit(req, { action: "video.deleted", entityType: "ProductVideo", entityId: req.params.videoId });
    res.json({ ok: true });
  })
);

export default router;
