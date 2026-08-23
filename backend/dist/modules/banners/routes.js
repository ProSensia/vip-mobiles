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
const router = (0, express_1.Router)();
router.get("/", (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const includeInactive = req.query.all === "1" && !!req.user;
    const now = new Date();
    const banners = await prisma_1.prisma.banner.findMany({
        where: {
            ...(includeInactive ? {} : { isActive: true }),
            ...(req.query.placement ? { placement: req.query.placement } : {}),
        },
        orderBy: { sortOrder: "asc" },
    });
    const visible = includeInactive
        ? banners
        : banners.filter((b) => (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt >= now));
    res.json({ banners: visible });
}));
const bannerSchema = zod_1.z.object({
    title: zod_1.z.string().max(200).optional().nullable(),
    imageUrl: zod_1.z.string().min(1),
    mobileImageUrl: zod_1.z.string().optional().nullable(),
    link: zod_1.z.string().max(300).optional().nullable(),
    placement: zod_1.z.enum(["HOME_HERO", "HOME_STRIP", "CATALOG_TOP"]).optional(),
    isActive: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().optional(),
    startsAt: zod_1.z.coerce.date().optional().nullable(),
    endsAt: zod_1.z.coerce.date().optional().nullable(),
});
router.post("/", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CONTENT_BANNERS), (0, validate_1.validateBody)(bannerSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const banner = await prisma_1.prisma.banner.create({ data: req.body });
    await (0, audit_1.recordAudit)(req, { action: "banner.created", entityType: "Banner", entityId: banner.id });
    res.status(201).json({ banner });
}));
router.patch("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CONTENT_BANNERS), (0, validate_1.validateBody)(bannerSchema.partial()), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const banner = await prisma_1.prisma.banner.update({ where: { id: req.params.id }, data: req.body });
    await (0, audit_1.recordAudit)(req, { action: "banner.updated", entityType: "Banner", entityId: banner.id });
    res.json({ banner });
}));
router.delete("/:id", auth_1.authenticate, (0, auth_1.requirePermission)(shared_1.PERMISSIONS.CONTENT_BANNERS), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.banner.delete({ where: { id: req.params.id } });
    await (0, audit_1.recordAudit)(req, { action: "banner.deleted", entityType: "Banner", entityId: req.params.id });
    res.json({ ok: true });
}));
exports.default = router;
