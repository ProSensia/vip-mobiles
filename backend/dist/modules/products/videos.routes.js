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
const videoSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    caption: zod_1.z.string().max(300).optional().nullable(),
});
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_EDIT), (0, validate_1.validateBody)(videoSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const productId = req.params.id;
    const { platform, embedId } = (0, shared_1.parseSocialVideoUrl)(req.body.url);
    if (!platform) {
        throw new errorHandler_1.ApiError(400, "URL must be a supported YouTube, TikTok or Instagram link");
    }
    const count = await prisma_1.prisma.productVideo.count({ where: { productId } });
    const video = await prisma_1.prisma.productVideo.create({
        data: { productId, platform, url: req.body.url, embedId, caption: req.body.caption, sortOrder: count },
    });
    await (0, audit_1.recordAudit)(req, { action: "video.created", entityType: "ProductVideo", entityId: video.id });
    res.status(201).json({ video });
}));
router.delete("/:videoId", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.PRODUCTS_EDIT), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.productVideo.delete({ where: { id: req.params.videoId } });
    await (0, audit_1.recordAudit)(req, { action: "video.deleted", entityType: "ProductVideo", entityId: req.params.videoId });
    res.json({ ok: true });
}));
exports.default = router;
